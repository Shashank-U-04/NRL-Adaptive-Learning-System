"""
Training script for the Personalized Learning and Intelligent Assessment System.

This script trains a Q-Learning agent to learn optimal teaching strategies
in the student learning environment over 1000 episodes.
"""

import numpy as np
from typing import Dict
from backend.app.ml.student_env import StudentLearningEnv
from backend.app.ml.q_agent import QLearningAgent
from backend.app.ml.config import (
    NUM_EPISODES, MAX_STEPS, EVAL_INTERVAL, GAMMA, ALPHA,
    EPSILON_START, EPSILON_DECAY, EPSILON_MIN
)
import pickle


def train_agent(save_path: str = "trained_agent.pkl", rewards_path: str = "training_rewards.pkl"):
    """
    Train the Q-Learning agent in the student learning environment.

    Args:
        save_path: Path to save the trained agent
        rewards_path: Path to save training rewards history
    """
    # Initialize environment and agent
    env = StudentLearningEnv()
    agent = QLearningAgent(
        alpha=ALPHA,
        gamma=GAMMA,
        epsilon_start=EPSILON_START,
        epsilon_decay=EPSILON_DECAY,
        epsilon_min=EPSILON_MIN
    )

    print("Starting Q-Learning training...")
    print(f"Training for {NUM_EPISODES} episodes with max {MAX_STEPS} steps per episode")
    print(f"Hyperparameters: alpha={ALPHA}, gamma={GAMMA}, epsilon_start={EPSILON_START}, epsilon_decay={EPSILON_DECAY}")
    print("=" * 60)

    episode_rewards = []
    episode_lengths = []

    for episode in range(NUM_EPISODES):
        # Reset environment for new episode
        state = env.reset()
        episode_reward = 0
        steps = 0
        done = False

        while not done and steps < MAX_STEPS:
            # Agent chooses action
            action = agent.choose_action(state)

            # Environment responds to action
            next_state, reward, done, info = env.step(action)

            # Agent learns from experience
            agent.update(state, action, reward, next_state)

            # Update tracking variables
            episode_reward += reward
            state = next_state
            steps += 1

        # Store episode statistics
        episode_rewards.append(episode_reward)
        episode_lengths.append(steps)

        # Decay epsilon
        agent.decay_epsilon()

        # Print progress every EVAL_INTERVAL episodes
        if (episode + 1) % EVAL_INTERVAL == 0:
            avg_reward = np.mean(episode_rewards[-EVAL_INTERVAL:])
            avg_length = np.mean(episode_lengths[-EVAL_INTERVAL:])
            q_table_stats = agent.get_q_table_stats()

            print(f"Episode {episode + 1:4d} | Average Reward: {avg_reward:7.2f} | "
                  f"Average Length: {avg_length:.1f} steps")
            print(f"Q-Table: {q_table_stats['num_states']} states, "
                  f"{q_table_stats['non_zero_q_values']} non-zero Q-values")
            print(f"Epsilon: {agent.epsilon:.4f}")
            print("-" * 40)

    print("=" * 60)
    print("Training completed!")
    print(f"Final Q-Table: {agent.get_q_table_stats()}")
    print(f"Final Epsilon: {agent.epsilon:.4f}")

    # Save trained agent and training history
    agent.episode_rewards = episode_rewards
    agent.episode_lengths = episode_lengths

    print(f"Saving trained agent to {save_path}...")
    agent.save_q_table(save_path)

    print(f"Saving training rewards to {rewards_path}...")
    with open(rewards_path, 'wb') as f:
        pickle.dump({
            'episode_rewards': episode_rewards,
            'episode_lengths': episode_lengths,
            'final_epsilon': agent.epsilon,
            'q_table_stats': agent.get_q_table_stats()
        }, f)

    return agent, episode_rewards, episode_lengths


def evaluate_agent(agent: QLearningAgent, env: StudentLearningEnv, num_episodes: int = 10) -> Dict[str, float]:
    """
    Evaluate a trained agent using greedy policy (no exploration).

    Args:
        agent: Trained Q-Learning agent
        env: Student learning environment
        num_episodes: Number of evaluation episodes

    Returns:
        Dictionary with evaluation metrics
    """
    print(f"Evaluating agent for {num_episodes} episodes...")

    evaluation_rewards = []
    evaluation_lengths = []
    successful_sessions = 0
    level_ups = 0
    dropouts = 0

    # Store original epsilon and set to 0 for pure exploitation
    original_epsilon = agent.epsilon
    agent.epsilon = 0.0

    for episode in range(num_episodes):
        state = env.reset()
        episode_reward = 0
        steps = 0
        done = False
        episode_level_ups = 0
        episode_dropout = False

        while not done and steps < MAX_STEPS:
            action = agent.choose_action(state)
            next_state, reward, done, info = env.step(action)

            episode_reward += reward
            state = next_state
            steps += 1

            if info.get("level_up", False):
                episode_level_ups += 1
            if info.get("dropout", False):
                episode_dropout = True

        evaluation_rewards.append(episode_reward)
        evaluation_lengths.append(steps)
        level_ups += episode_level_ups

        if episode_dropout:
            dropouts += 1
        elif info.get("session_successful", False):
            successful_sessions += 1

    # Restore original epsilon
    agent.epsilon = original_epsilon

    results = {
        "avg_reward": np.mean(evaluation_rewards),
        "std_reward": np.std(evaluation_rewards),
        "avg_length": np.mean(evaluation_lengths),
        "successful_sessions": successful_sessions,
        "total_level_ups": level_ups,
        "dropouts": dropouts,
        "success_rate": successful_sessions / num_episodes * 100
    }

    print("Evaluation Results:")
    print(f"Average Reward: {results['avg_reward']:.2f}")
    print(f"Reward Std Dev: {results['std_reward']:.2f}")
    print(f"Average Length: {results['avg_length']:.2f}")
    print(f"Success Rate: {results['success_rate']:.1f}%")
    print(f"Successful Sessions: {successful_sessions}/{num_episodes}")
    print(f"Total Level-ups: {level_ups}")
    print(f"Dropouts: {dropouts}")

    return results


if __name__ == "__main__":
    # Train the agent
    trained_agent, rewards, lengths = train_agent()

    # Evaluate the trained agent
    env = StudentLearningEnv()
    eval_results = evaluate_agent(trained_agent, env, num_episodes=20)

    print("\nTraining and evaluation completed successfully!")
