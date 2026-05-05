"""
Q-Learning Agent for the Personalized Learning and Intelligent Assessment System.

This module implements a Q-Learning agent that learns optimal teaching strategies
to maximize student learning and engagement in the student learning environment.
"""

import random
import pickle
from typing import Dict, Tuple, Optional
from app.ml.config import (
    ACTIONS, GAMMA, ALPHA, EPSILON_START, EPSILON_DECAY, EPSILON_MIN,
    MAX_STEPS, NUM_EPISODES
)


class QLearningAgent:
    """
    Q-Learning agent with epsilon-greedy exploration for the student learning environment.

    Uses a dictionary-based Q-table to handle the sparse 6-dimensional state space efficiently.
    State is represented as a tuple: (knowledge_level, current_topic, question_difficulty,
                                      consecutive_correct, consecutive_wrong, engagement_score)
    """

    def __init__(self, alpha: float = ALPHA, gamma: float = GAMMA,
                 epsilon_start: float = EPSILON_START, epsilon_decay: float = EPSILON_DECAY,
                 epsilon_min: float = EPSILON_MIN):
        """
        Initialize the Q-Learning agent.

        Args:
            alpha: Learning rate
            gamma: Discount factor
            epsilon_start: Initial epsilon for exploration
            epsilon_decay: Epsilon decay rate per episode
            epsilon_min: Minimum epsilon value
        """
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon_start
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min

        # Q-table: dict with state tuples as keys, list of Q-values as values
        # state -> [Q(s,a0), Q(s,a1), ..., Q(s,a6)]
        self.q_table: Dict[Tuple[int, ...], list] = {}

        # Training statistics
        self.episode_rewards = []
        self.episode_lengths = []

    def get_q_value(self, state: Tuple[int, ...], action: int) -> float:
        """
        Get the Q-value for a state-action pair.

        Args:
            state: State tuple
            action: Action index

        Returns:
            Q-value for the state-action pair
        """
        if state not in self.q_table:
            # Initialize Q-values for new state (all zeros)
            self.q_table[state] = [0.0] * len(ACTIONS)

        return self.q_table[state][action]

    def set_q_value(self, state: Tuple[int, ...], action: int, value: float):
        """
        Set the Q-value for a state-action pair.

        Args:
            state: State tuple
            action: Action index
            value: New Q-value
        """
        if state not in self.q_table:
            self.q_table[state] = [0.0] * len(ACTIONS)

        self.q_table[state][action] = value

    def choose_action(self, state: Tuple[int, ...]) -> int:
        """
        Choose an action using epsilon-greedy policy.

        Args:
            state: Current state tuple

        Returns:
            Selected action index
        """
        # Epsilon-greedy exploration
        if random.random() < self.epsilon:
            # Explore: random action
            return random.randint(0, len(ACTIONS) - 1)
        else:
            # Exploit: best action according to current Q-values
            if state not in self.q_table:
                # Initialize Q-values for new state
                self.q_table[state] = [0.0] * len(ACTIONS)
                return random.randint(0, len(ACTIONS) - 1)

            q_values = self.q_table[state]
            max_q = max(q_values)

            # Handle ties by selecting randomly among best actions
            best_actions = [i for i, q in enumerate(q_values) if q == max_q]
            return random.choice(best_actions)

    def update(self, state: Tuple[int, ...], action: int, reward: float, next_state: Tuple[int, ...]):
        """
        Update Q-value using the Q-Learning update rule.

        Q(s,a) = Q(s,a) + α * [r + γ * max_a' Q(s',a') - Q(s,a)]

        Args:
            state: Current state tuple
            action: Action taken
            reward: Reward received
            next_state: Next state tuple
        """
        # Get current Q-value
        current_q = self.get_q_value(state, action)

        # Get maximum Q-value for next state
        if next_state not in self.q_table:
            self.q_table[next_state] = [0.0] * len(ACTIONS)

        max_next_q = max(self.q_table[next_state])

        # Q-Learning update
        new_q = current_q + self.alpha * (reward + self.gamma * max_next_q - current_q)

        # Update Q-table
        self.set_q_value(state, action, new_q)

    def decay_epsilon(self):
        """Decay epsilon for exploration-exploitation balance."""
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)

    def get_policy(self, state: Tuple[int, ...]) -> int:
        """
        Get the greedy (exploitation-only) action for a state.

        Args:
            state: State tuple

        Returns:
            Best action according to current policy
        """
        if state not in self.q_table:
            return random.randint(0, len(ACTIONS) - 1)

        q_values = self.q_table[state]
        max_q = max(q_values)
        best_actions = [i for i, q in enumerate(q_values) if q == max_q]
        return random.choice(best_actions)

    def save_q_table(self, filepath: str):
        """
        Save the Q-table to a file.

        Args:
            filepath: Path to save the Q-table
        """
        with open(filepath, 'wb') as f:
            pickle.dump(self.q_table, f)

    def load_q_table(self, filepath: str):
        """
        Load the Q-table from a file.

        Args:
            filepath: Path to load the Q-table from
        """
        try:
            with open(filepath, 'rb') as f:
                self.q_table = pickle.load(f)
        except FileNotFoundError:
            print(f"Q-table file {filepath} not found. Starting with empty Q-table.")

    def get_q_table_stats(self) -> Dict[str, int]:
        """
        Get statistics about the Q-table.

        Returns:
            Dictionary with Q-table statistics
        """
        return {
            "num_states": len(self.q_table),
            "total_state_action_pairs": len(self.q_table) * len(ACTIONS),
            "non_zero_q_values": sum(1 for q_values in self.q_table.values()
                                   for q in q_values if q != 0.0)
        }

    def reset(self):
        """Reset the agent (clear Q-table and reset epsilon)."""
        self.q_table = {}
        self.epsilon = EPSILON_START
        self.episode_rewards = []
        self.episode_lengths = []
