"""
Visualization script for the Personalized Learning and Intelligent Assessment System.

This script loads training results and generates plots showing the agent's learning progress,
including total reward per episode with moving averages to demonstrate convergence.
"""

import pickle
import numpy as np
import matplotlib.pyplot as plt
from app.ml.config import MOVING_AVERAGE_WINDOW, NUM_EPISODES
from typing import List, Dict, Tuple


def load_training_data(rewards_path: str = "training_rewards.pkl") -> Dict[str, any]:
    """
    Load training data from pickle file.

    Args:
        rewards_path: Path to the training rewards file

    Returns:
        Dictionary containing training data
    """
    try:
        with open(rewards_path, 'rb') as f:
            data = pickle.load(f)
        print(f"Successfully loaded training data from {rewards_path}")
        return data
    except FileNotFoundError:
        print(f"Training data file {rewards_path} not found.")
        print("Please run train.py first to generate training data.")
        return None


def calculate_moving_average(data: List[float], window_size: int) -> List[float]:
    """
    Calculate moving average of a data series.

    Args:
        data: List of values
        window_size: Size of the moving average window

    Returns:
        List of moving average values
    """
    if len(data) < window_size:
        return data

    moving_averages = []
    for i in range(len(data)):
        if i < window_size - 1:
            # For the first few points, use available data
            moving_averages.append(np.mean(data[:i+1]))
        else:
            # Use full window
            moving_averages.append(np.mean(data[i-window_size+1:i+1]))

    return moving_averages


def plot_training_rewards(episode_rewards: List[float], save_path: str = None):
    """
    Plot training rewards with moving average.

    Args:
        episode_rewards: List of episode rewards
        save_path: Optional path to save the plot
    """
    episodes = list(range(1, len(episode_rewards) + 1))
    moving_avg_rewards = calculate_moving_average(episode_rewards, MOVING_AVERAGE_WINDOW)

    plt.figure(figsize=(12, 8))

    # Plot individual episode rewards
    plt.plot(episodes, episode_rewards, alpha=0.3, color='lightblue',
             label='Episode Reward', linewidth=1)

    # Plot moving average
    plt.plot(episodes, moving_avg_rewards, color='darkblue', linewidth=2,
             label=f'Moving Average (window={MOVING_AVERAGE_WINDOW})')

    plt.xlabel('Episode', fontsize=12)
    plt.ylabel('Total Reward', fontsize=12)
    plt.title('Q-Learning Training Progress: Total Reward per Episode', fontsize=14, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)

    # Add statistics text
    final_avg = np.mean(episode_rewards[-100:]) if len(episode_rewards) >= 100 else np.mean(episode_rewards)
    max_reward = np.max(episode_rewards)
    plt.text(0.02, 0.98, f'Final 100-episode avg: {final_avg:.1f}\nMax reward: {max_reward:.1f}',
             transform=plt.gca().transAxes, verticalalignment='top',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Plot saved to {save_path}")

    # plt.show()


def plot_reward_distribution(episode_rewards: List[float], save_path: str = None):
    """
    Plot reward distribution histogram.

    Args:
        episode_rewards: List of episode rewards
        save_path: Optional path to save the plot
    """
    plt.figure(figsize=(10, 6))

    plt.hist(episode_rewards, bins=50, alpha=0.7, color='skyblue', edgecolor='black')
    plt.xlabel('Total Reward', fontsize=12)
    plt.ylabel('Frequency', fontsize=12)
    plt.title('Distribution of Episode Rewards', fontsize=14, fontweight='bold')
    plt.grid(True, alpha=0.3)

    # Add statistics
    mean_reward = np.mean(episode_rewards)
    std_reward = np.std(episode_rewards)
    plt.axvline(mean_reward, color='red', linestyle='--', linewidth=2,
                label=f'Mean: {mean_reward:.1f}')
    plt.legend()

    plt.text(0.02, 0.98, f'Std Dev: {std_reward:.1f}',
             transform=plt.gca().transAxes, verticalalignment='top',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Plot saved to {save_path}")

    # plt.show()


def plot_learning_curves(episode_rewards: List[float], episode_lengths: List[float], save_path: str = None):
    """
    Plot learning curves showing rewards and episode lengths.

    Args:
        episode_rewards: List of episode rewards
        episode_lengths: List of episode lengths
        save_path: Optional path to save the plot
    """
    episodes = list(range(1, len(episode_rewards) + 1))

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))

    # Plot rewards
    moving_avg_rewards = calculate_moving_average(episode_rewards, MOVING_AVERAGE_WINDOW)
    ax1.plot(episodes, episode_rewards, alpha=0.3, color='lightblue', label='Episode Reward')
    ax1.plot(episodes, moving_avg_rewards, color='darkblue', linewidth=2,
             label=f'Moving Average (window={MOVING_AVERAGE_WINDOW})')
    ax1.set_ylabel('Total Reward', fontsize=12)
    ax1.set_title('Training Progress: Rewards and Episode Lengths', fontsize=14, fontweight='bold')
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Plot episode lengths
    moving_avg_lengths = calculate_moving_average(episode_lengths, MOVING_AVERAGE_WINDOW)
    ax2.plot(episodes, episode_lengths, alpha=0.3, color='lightcoral', label='Episode Length')
    ax2.plot(episodes, moving_avg_lengths, color='darkred', linewidth=2,
             label=f'Moving Average (window={MOVING_AVERAGE_WINDOW})')
    ax2.set_xlabel('Episode', fontsize=12)
    ax2.set_ylabel('Episode Length (steps)', fontsize=12)
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Plot saved to {save_path}")

    # plt.show()


def print_training_summary(data: Dict[str, any]):
    """Print a summary of training results."""
    episode_rewards = data['episode_rewards']
    episode_lengths = data['episode_lengths']

    print("=" * 60)
    print("TRAINING SUMMARY")
    print("=" * 60)

    print(f"Total Episodes: {len(episode_rewards)}")
    print(f"Final Epsilon: {data.get('final_epsilon', 'N/A'):.4f}")

    print("\nREWARD STATISTICS:")
    print(f"  Overall Average: {np.mean(episode_rewards):.2f}")
    print(f"  Standard Deviation: {np.std(episode_rewards):.2f}")
    print(f"  Minimum: {np.min(episode_rewards):.2f}")
    print(f"  Maximum: {np.max(episode_rewards):.2f}")
    print(f"  Final 100 episodes average: {np.mean(episode_rewards[-100:]):.2f}")

    print("\nEPISODE LENGTH STATISTICS:")
    print(f"  Overall Average: {np.mean(episode_lengths):.2f}")
    print(f"  Standard Deviation: {np.std(episode_lengths):.2f}")
    print(f"  Minimum: {np.min(episode_lengths)}")
    print(f"  Maximum: {np.max(episode_lengths)}")

    q_stats = data.get('q_table_stats', {})
    if q_stats:
        print("\nQ-TABLE STATISTICS:")
        print(f"  Number of States Visited: {q_stats.get('num_states', 0)}")
        print(f"  Total State-Action Pairs: {q_stats.get('total_state_action_pairs', 0)}")
        print(f"  Non-zero Q-Values: {q_stats.get('non_zero_q_values', 0)}")

    print("=" * 60)


def main():
    """Main function to load and visualize training results."""
    # Load training data
    data = load_training_data()
    if data is None:
        return

    episode_rewards = data['episode_rewards']
    episode_lengths = data['episode_lengths']

    # Print summary
    print_training_summary(data)

    # Create plots
    print("\nGenerating plots...")

    # Main reward plot
    plot_training_rewards(episode_rewards, save_path="training_rewards.png")

    # Reward distribution
    plot_reward_distribution(episode_rewards, save_path="reward_distribution.png")

    # Learning curves (rewards and lengths)
    plot_learning_curves(episode_rewards, episode_lengths, save_path="learning_curves.png")

    print("Plot generation completed!")
    print("Plots saved as PNG files in the current directory.")


if __name__ == "__main__":
    main()
