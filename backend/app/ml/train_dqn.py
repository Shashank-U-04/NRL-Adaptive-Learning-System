"""
NRL Adaptive Learning System — DQN Training Pipeline

Trains the Dueling DQN defined in backend.app.ml.dqn_model on the simulated
adaptive-learning environment from student_env_v2. Saves weights to
RL_MODEL_PATH so the production rl_service can pick them up automatically.

Run:
    python -m backend.app.ml.train_dqn               # default 800 episodes
    python -m backend.app.ml.train_dqn --episodes 50 # quick smoke run
"""

from __future__ import annotations

import argparse
import logging
import random
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch import optim

from backend.app.core.config import RL_MODEL_PATH
from backend.app.ml.dqn_model import DQN, ReplayBuffer, encode_state
from backend.app.ml.student_env_v2 import AdaptiveStudentEnv

logger = logging.getLogger("nrl.train_dqn")

# ── Hyperparameters ──────────────────────────────────────────
DEFAULTS = {
    "episodes": 800,
    "batch_size": 64,
    "gamma": 0.95,
    "lr": 5e-4,
    "buffer_capacity": 20_000,
    "min_buffer_size": 500,
    "target_sync_steps": 200,
    "epsilon_start": 1.0,
    "epsilon_end": 0.05,
    "epsilon_decay_episodes": 500,
    "log_every": 25,
    "seed": 42,
}


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def epsilon_for_episode(episode: int, cfg: dict) -> float:
    """Linear decay from epsilon_start to epsilon_end across decay_episodes."""
    progress = min(1.0, episode / max(1, cfg["epsilon_decay_episodes"]))
    return cfg["epsilon_start"] + progress * (cfg["epsilon_end"] - cfg["epsilon_start"])


def select_action(
    q_net: DQN,
    state_tensor: torch.Tensor,
    epsilon: float,
    n_actions: int,
    device: torch.device,
) -> int:
    if random.random() < epsilon:
        return random.randint(0, n_actions - 1)
    with torch.no_grad():
        q_values = q_net(state_tensor.to(device))
    return int(q_values.argmax().item())


def optimize_step(
    q_net: DQN,
    target_net: DQN,
    optimizer: optim.Optimizer,
    buffer: ReplayBuffer,
    cfg: dict,
    device: torch.device,
) -> float | None:
    if len(buffer) < cfg["min_buffer_size"]:
        return None

    states, actions, rewards, next_states, dones = buffer.sample(cfg["batch_size"])
    states = states.to(device)
    actions = actions.to(device)
    rewards = rewards.to(device)
    next_states = next_states.to(device)
    dones = dones.to(device)

    # Q(s, a) for the actions actually taken
    q_values = q_net(states).gather(1, actions.unsqueeze(1)).squeeze(1)

    # Double-DQN target: action selected by online net, evaluated by target net
    with torch.no_grad():
        next_actions = q_net(next_states).argmax(dim=1, keepdim=True)
        next_q = target_net(next_states).gather(1, next_actions).squeeze(1)
        target = rewards + cfg["gamma"] * next_q * (1.0 - dones)

    loss = F.smooth_l1_loss(q_values, target)
    optimizer.zero_grad()
    loss.backward()
    torch.nn.utils.clip_grad_norm_(q_net.parameters(), max_norm=10.0)
    optimizer.step()
    return float(loss.item())


def train(cfg: dict | None = None, save_path: Path | None = None) -> dict:
    """Train and return summary statistics; saves weights to save_path."""
    cfg = {**DEFAULTS, **(cfg or {})}
    save_path = Path(save_path) if save_path else Path(RL_MODEL_PATH)
    save_path.parent.mkdir(parents=True, exist_ok=True)

    set_seed(cfg["seed"])
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Training on device: {device}")

    env = AdaptiveStudentEnv(seed=cfg["seed"])
    n_actions = AdaptiveStudentEnv.action_space_size()
    n_features = AdaptiveStudentEnv.state_size()

    q_net = DQN(input_size=n_features, hidden_size=128, output_size=n_actions).to(device)
    target_net = DQN(input_size=n_features, hidden_size=128, output_size=n_actions).to(device)
    target_net.load_state_dict(q_net.state_dict())
    target_net.eval()

    optimizer = optim.Adam(q_net.parameters(), lr=cfg["lr"])
    buffer = ReplayBuffer(capacity=cfg["buffer_capacity"])

    episode_rewards: list[float] = []
    episode_lengths: list[int] = []
    losses: list[float] = []

    global_step = 0
    started = time.time()

    for episode in range(1, cfg["episodes"] + 1):
        state = env.reset()
        state_tensor = encode_state(state)
        epsilon = epsilon_for_episode(episode, cfg)
        ep_reward = 0.0
        ep_length = 0
        done = False

        while not done:
            action = select_action(q_net, state_tensor.unsqueeze(0), epsilon, n_actions, device)
            next_state, reward, done, _info = env.step(action)
            next_state_tensor = encode_state(next_state)

            buffer.push(state_tensor, action, reward, next_state_tensor, float(done))
            state_tensor = next_state_tensor
            ep_reward += reward
            ep_length += 1
            global_step += 1

            loss = optimize_step(q_net, target_net, optimizer, buffer, cfg, device)
            if loss is not None:
                losses.append(loss)

            if global_step % cfg["target_sync_steps"] == 0:
                target_net.load_state_dict(q_net.state_dict())

        episode_rewards.append(ep_reward)
        episode_lengths.append(ep_length)

        if episode % cfg["log_every"] == 0 or episode == cfg["episodes"]:
            recent = episode_rewards[-cfg["log_every"]:]
            avg_reward = sum(recent) / len(recent)
            avg_length = sum(episode_lengths[-cfg["log_every"]:]) / len(episode_lengths[-cfg["log_every"]:])
            recent_loss = sum(losses[-200:]) / max(1, len(losses[-200:])) if losses else float("nan")
            logger.info(
                f"ep {episode:4d}/{cfg['episodes']} | "
                f"reward(avg{cfg['log_every']})={avg_reward:6.2f} | "
                f"length={avg_length:4.1f} | "
                f"loss={recent_loss:.4f} | "
                f"eps={epsilon:.3f} | "
                f"buffer={len(buffer)}"
            )

    duration = time.time() - started
    # Save weights only — rl_service does load_state_dict with weights_only=True
    torch.save(q_net.state_dict(), save_path)
    logger.info(f"Saved DQN weights to {save_path} ({duration:.1f}s)")

    return {
        "episodes": cfg["episodes"],
        "duration_seconds": round(duration, 1),
        "final_avg_reward": round(sum(episode_rewards[-50:]) / max(1, len(episode_rewards[-50:])), 3),
        "best_reward": round(max(episode_rewards), 3),
        "final_loss": round(sum(losses[-200:]) / max(1, len(losses[-200:])), 4) if losses else None,
        "save_path": str(save_path),
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train DQN agent for NRL adaptive learning.")
    p.add_argument("--episodes", type=int, default=DEFAULTS["episodes"])
    p.add_argument("--batch-size", type=int, default=DEFAULTS["batch_size"])
    p.add_argument("--gamma", type=float, default=DEFAULTS["gamma"])
    p.add_argument("--lr", type=float, default=DEFAULTS["lr"])
    p.add_argument("--seed", type=int, default=DEFAULTS["seed"])
    p.add_argument("--output", type=str, default=str(RL_MODEL_PATH))
    return p.parse_args()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    args = parse_args()
    cfg = {
        "episodes": args.episodes,
        "batch_size": args.batch_size,
        "gamma": args.gamma,
        "lr": args.lr,
        "seed": args.seed,
    }
    summary = train(cfg=cfg, save_path=Path(args.output))
    logger.info(f"Training summary: {summary}")


if __name__ == "__main__":
    main()
