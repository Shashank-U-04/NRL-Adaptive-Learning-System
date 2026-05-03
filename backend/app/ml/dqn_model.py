"""
NRL Adaptive Learning System — DQN Model Components

Rich 7-feature state vector:
  1. quiz_accuracy      -> [0.0, 1.0]
  2. mcq_accuracy       -> [0.0, 1.0]
  3. lab_success_rate   -> [0.0, 1.0]
  4. recent_trend       -> declining=0.0 | stable=0.5 | improving=1.0
  5. attempts_count     -> normalised / 100
  6. avg_response_time  -> normalised / 60 (seconds)
  7. topic_confidence   -> [0.0, 1.0]
"""

import random
from collections import deque

import torch
import torch.nn as nn
import torch.nn.functional as F


_TREND_MAP = {"declining": 0.0, "stable": 0.5, "improving": 1.0}


def encode_state(state: dict) -> torch.Tensor:
    """Convert a rich state dict into a normalised float32 tensor."""
    qa  = float(state.get("quiz_accuracy", 0.5))
    ma  = float(state.get("mcq_accuracy", 0.5))
    ls  = float(state.get("lab_success_rate", 0.5))
    rt  = _TREND_MAP.get(state.get("recent_trend", "stable"), 0.5)
    ac  = min(100.0, float(state.get("attempts_count", 0))) / 100.0
    art = min(60.0,  float(state.get("avg_response_time", 10.0))) / 60.0
    tc  = float(state.get("topic_confidence", 0.5))
    return torch.tensor([qa, ma, ls, rt, ac, art, tc], dtype=torch.float32)


class DQN(nn.Module):
    """Dueling Deep Q-Network for adaptive question selection."""

    def __init__(self, input_size: int = 7, hidden_size: int = 128, output_size: int = 7):
        super().__init__()
        self.shared = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
        )
        # Value stream
        self.value_stream = nn.Linear(hidden_size, 1)
        # Advantage stream
        self.advantage_stream = nn.Linear(hidden_size, output_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        shared = self.shared(x)
        value = self.value_stream(shared)
        advantage = self.advantage_stream(shared)
        # Combine: Q = V + (A - mean(A))  — Dueling DQN formula
        q_values = value + (advantage - advantage.mean(dim=-1, keepdim=True))
        return q_values


class ReplayBuffer:
    """Experience Replay Buffer for DQN training stability."""

    def __init__(self, capacity: int = 10_000):
        self.buffer: deque = deque(maxlen=capacity)

    def push(
        self,
        state: torch.Tensor,
        action: int,
        reward: float,
        next_state: torch.Tensor,
        done: bool,
    ) -> None:
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size: int):
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        return (
            torch.stack(states),
            torch.tensor(actions, dtype=torch.long),
            torch.tensor(rewards, dtype=torch.float32),
            torch.stack(next_states),
            torch.tensor(dones, dtype=torch.float32),
        )

    def __len__(self) -> int:
        return len(self.buffer)
