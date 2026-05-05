import os
import sys
import logging
import random
import numpy as np
from pathlib import Path

# Setup path so we can import from backend
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import torch
import torch.nn as nn
import torch.optim as optim

from app.ml.dqn_model import DQN, ReplayBuffer, encode_state
from app.services.rl_service import ACTIONS

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- Model Version ---
MODEL_VERSION = "v1.0"

# --- Reproducibility ---
def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

set_seed(42)

# --- Hyperparameters ---
BATCH_SIZE = 64
LR = 1e-3
GAMMA = 0.99
TAU = 0.005 # Soft Target Update Parameter
MEMORY_CAPACITY = 20000
WARMUP_STEPS = 1000
NUM_EPISODES = 1000
MAX_STEPS = 30
EVAL_FREQ = 100
CHECKPOINT_FREQ = 100

EPSILON_START = 1.0
EPSILON_END = 0.1
# Decay chosen to reach 0.1 at ~1150 episodes, ensuring stable exploration throughout training
EPSILON_DECAY = 0.998 

# --- Device Management ---
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")

# --- Environment Simulator ---
class LearningEnvironment:
    """
    Simulates a student interacting with the adaptive learning system.
    """
    def __init__(self):
        self.state = self.reset()
        # Metrics Tracking
        self.total_questions_asked = 0
        self.total_correct_answers = 0
        self.difficulty_history = []
        
    def reset(self):
        self.state = {
            "knowledge_level": 0,
            "current_topic": 0,
            "question_difficulty": 0,
            "consecutive_correct": 0,
            "consecutive_wrong": 0,
            "engagement_score": random.choice([0, 1, 2]),
        }
        self.steps = 0
        self.total_questions_asked = 0
        self.total_correct_answers = 0
        self.difficulty_history = []
        return self.state

    def _simulate_student_answer(self, action_idx: int) -> bool:
        """Simulates if the student answers correctly (Stochastic behavior)."""
        action_name = ACTIONS.get(action_idx, "")
        
        difficulty = 0
        if "Medium" in action_name:
            difficulty = 1
        elif "Hard" in action_name:
            difficulty = 2
            
        self.state["question_difficulty"] = difficulty
        self.difficulty_history.append(difficulty)
        
        kl = self.state["knowledge_level"]
        eng = self.state["engagement_score"]
        
        base_prob = 0.5
        if kl > difficulty:
            base_prob = 0.85 
        elif kl < difficulty:
            base_prob = 0.20 
            
        if eng == 2:
            base_prob += 0.1
        elif eng == 0:
            base_prob -= 0.15
            
        base_prob = np.clip(base_prob + random.uniform(-0.1, 0.1), 0.05, 0.95)
        is_correct = random.random() < base_prob
        
        self.total_questions_asked += 1
        if is_correct:
            self.total_correct_answers += 1
            
        return is_correct

    def step(self, action_idx: int):
        self.steps += 1
        action_name = ACTIONS.get(action_idx, "")
        
        is_correct = False
        done = False
        reward = 0.0
        
        if action_name == "End_Session" or self.steps >= MAX_STEPS:
            done = True
            if self.state["knowledge_level"] == 2 and self.state["current_topic"] == 2:
                reward += 2.0 # Max completion reward
            return self.state, reward, done
            
        elif action_name == "Move_To_Next_Topic":
            if self.state["current_topic"] < 2 and self.state["knowledge_level"] >= 1:
                self.state["current_topic"] += 1
                self.state["knowledge_level"] = max(0, self.state["knowledge_level"] - 1)
                self.state["consecutive_correct"] = 0
                self.state["consecutive_wrong"] = 0
                reward += 0.5 
            else:
                reward -= 1.0 # Penalty
                
        elif action_name == "Review_Previous_Topic":
            if self.state["current_topic"] > 0:
                self.state["current_topic"] -= 1
                reward -= 0.1
            else:
                reward -= 1.0 
                
        elif action_name == "Give_Hint":
            self.state["engagement_score"] = min(2, self.state["engagement_score"] + 1)
            reward += 0.1
            
        else:
            is_correct = self._simulate_student_answer(action_idx)
            reward = self._calculate_reward(self.state, is_correct)
            self.state = self._update_state(self.state, is_correct)
            
            if self.state["consecutive_wrong"] >= 4 and self.state["engagement_score"] == 0:
                done = True
                reward -= 2.0 # Session failure

        return self.state, reward, done

    # --- Normalized Reward Scale [-2, +2] ---
    def _calculate_reward(self, state: dict, is_correct: bool) -> float:
        """
        Rewards learning progression scaled tightly between roughly -2.0 and +2.0.
        """
        reward = 0.0
        diff = state.get("question_difficulty", 0)
        kl = state.get("knowledge_level", 0)

        if is_correct:
            if diff == kl:
                reward += 0.5
            elif diff > kl:
                reward += 0.8
            else:
                reward += 0.2
                
            if state["consecutive_correct"] + 1 >= 3:
                reward += 0.3 
        else:
            if diff > kl:
                reward -= 0.2 
            elif diff == kl:
                reward -= 0.5 
            else:
                reward -= 0.8 
                
            if state["consecutive_wrong"] + 1 >= 3:
                reward -= 0.5 

        # Clamp reward to prevent extreme spikes
        return np.clip(reward, -2.0, 2.0)

    def _update_state(self, state: dict, is_correct: bool) -> dict:
        new = state.copy()
        if is_correct:
            new["consecutive_correct"] += 1
            new["consecutive_wrong"] = 0
            if new["consecutive_correct"] >= 3:
                new["knowledge_level"] = min(2, new["knowledge_level"] + 1)
                new["consecutive_correct"] = 0
            if random.random() < 0.3:
                new["engagement_score"] = min(2, new["engagement_score"] + 1)
        else:
            new["consecutive_correct"] = 0
            new["consecutive_wrong"] += 1
            if random.random() < 0.4:
                new["engagement_score"] = max(0, new["engagement_score"] - 1)
        return new


def train():
    env = LearningEnvironment()
    
    input_size = 6
    output_size = len(ACTIONS)
    
    policy_net = DQN(input_size, 64, output_size).to(device)
    target_net = DQN(input_size, 64, output_size).to(device)
    target_net.load_state_dict(policy_net.state_dict())
    target_net.eval()
    
    optimizer = optim.Adam(policy_net.parameters(), lr=LR)
    # --- Learning Rate Scheduler ---
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=200, gamma=0.9)
    
    memory = ReplayBuffer(MEMORY_CAPACITY)
    
    epsilon = EPSILON_START
    
    models_dir = Path(__file__).resolve().parent / "app" / "ml" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("Filling Replay Buffer (Stochastic Warm-up)...")
    state_dict = env.reset()
    state_tensor = encode_state(state_dict).to(device)
    for _ in range(WARMUP_STEPS):
        # Actions chosen entirely randomly during warm-up across the stochastic environment
        action = random.randrange(output_size)
        next_state_dict, reward, done = env.step(action)
        next_state_tensor = encode_state(next_state_dict).to(device)
        memory.push(state_tensor, action, reward, next_state_tensor, done)
        if done:
            state_dict = env.reset()
            state_tensor = encode_state(state_dict).to(device)
        else:
            state_tensor = next_state_tensor

    logger.info("Starting Double DQN Training Loop...")
    
    for episode in range(1, NUM_EPISODES + 1):
        state_dict = env.reset()
        state_tensor = encode_state(state_dict).to(device)
        
        total_reward = 0
        episode_loss = 0.0
        steps = 0
        
        done = False
        while not done:
            if random.random() < epsilon:
                action = random.randrange(output_size)
            else:
                with torch.no_grad():
                    q_values = policy_net(state_tensor.unsqueeze(0))
                    action = q_values.argmax().item()
                    
            next_state_dict, reward, done = env.step(action)
            next_state_tensor = encode_state(next_state_dict).to(device)
            
            memory.push(state_tensor, action, reward, next_state_tensor, done)
            state_tensor = next_state_tensor
            
            total_reward += reward
            steps += 1
            
            b_states, b_actions, b_rewards, b_next_states, b_dones = memory.sample(BATCH_SIZE)
            
            b_states = b_states.to(device)
            b_actions = b_actions.to(device)
            b_rewards = b_rewards.to(device)
            b_next_states = b_next_states.to(device)
            b_dones = b_dones.to(device)
            
            q_values = policy_net(b_states).gather(1, b_actions.unsqueeze(1)).squeeze(1)
            
            with torch.no_grad():
                next_actions = policy_net(b_next_states).argmax(1).unsqueeze(1)
                next_q_values = target_net(b_next_states).gather(1, next_actions).squeeze(1)
                target_q_values = b_rewards + (GAMMA * next_q_values * (1 - b_dones))
                
            # --- Huber Loss ---
            loss = nn.SmoothL1Loss()(q_values, target_q_values)
            
            optimizer.zero_grad()
            loss.backward()
            
            torch.nn.utils.clip_grad_norm_(policy_net.parameters(), max_norm=1.0)
            optimizer.step()
            
            episode_loss += loss.item()
                
            # --- Soft Target Updates (Polyak Averaging) ---
            for target_param, policy_param in zip(target_net.parameters(), policy_net.parameters()):
                target_param.data.copy_(TAU * policy_param.data + (1.0 - TAU) * target_param.data)

        epsilon = max(EPSILON_END, epsilon * EPSILON_DECAY)
        scheduler.step()
        
        # --- Versioned Checkpointing ---
        if episode % CHECKPOINT_FREQ == 0:
            chk_path = models_dir / f"dqn_agent_{MODEL_VERSION}_ep{episode}.pt"
            torch.save(policy_net.state_dict(), str(chk_path))
            
        if episode % 10 == 0:
            avg_loss = episode_loss / steps if steps > 0 else 0
            logger.info(f"Train Ep {episode:4d}/{NUM_EPISODES} | Reward: {total_reward:6.2f} | Loss: {avg_loss:.4f} | Epsilon: {epsilon:.3f} | LR: {scheduler.get_last_lr()[0]:.1e}")

        # --- Enhanced Evaluation Metrics ---
        if episode % EVAL_FREQ == 0:
            policy_net.eval()
            eval_reward = 0.0
            e_state_dict = env.reset()
            e_state_tensor = encode_state(e_state_dict).to(device)
            e_done = False
            
            while not e_done:
                with torch.no_grad():
                    e_action = policy_net(e_state_tensor.unsqueeze(0)).argmax().item()
                e_next_state_dict, e_r, e_done = env.step(e_action)
                eval_reward += e_r
                e_state_tensor = encode_state(e_next_state_dict).to(device)
            
            # Compute evaluation metrics
            success_rate = (env.total_correct_answers / env.total_questions_asked) * 100 if env.total_questions_asked > 0 else 0.0
            avg_difficulty = sum(env.difficulty_history) / len(env.difficulty_history) if env.difficulty_history else 0.0
            
            logger.info(f"=== EVALUATION Ep {episode} ===")
            logger.info(f"    Avg Reward:       {eval_reward/env.steps:.2f} per step")
            logger.info(f"    Total Reward:     {eval_reward:.2f}")
            logger.info(f"    Success Rate:     {success_rate:.1f}% ({env.total_correct_answers}/{env.total_questions_asked})")
            logger.info(f"    Avg Difficulty:   {avg_difficulty:.2f}")
            logger.info(f"===============================")
            
            policy_net.train()

    # Save Final Model
    final_model_path = models_dir / "dqn_agent.pt"
    torch.save(policy_net.state_dict(), str(final_model_path))
    logger.info(f"Training Complete! Final '{MODEL_VERSION}' model saved to {final_model_path}")

if __name__ == "__main__":
    train()
