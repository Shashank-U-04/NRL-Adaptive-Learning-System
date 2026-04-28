"""
Configuration constants and mappings for the Personalized Learning and Intelligent Assessment System.
"""

# State space mappings
KNOWLEDGE_LEVELS = {
    0: "Beginner",
    1: "Intermediate",
    2: "Advanced"
}

TOPICS = {
    0: "Topic 1",
    1: "Topic 2",
    2: "Topic 3"
}

QUESTION_DIFFICULTIES = {
    0: "Easy",
    1: "Medium",
    2: "Hard"
}

ENGAGEMENT_LEVELS = {
    0: "Low",
    1: "Medium",
    2: "High"
}

# Action space (index 0-6)
ACTIONS = {
    0: "Present_Easy_Question",
    1: "Present_Medium_Question",
    2: "Present_Hard_Question",
    3: "Give_Hint",
    4: "Review_Previous_Topic",
    5: "Move_To_Next_Topic",
    6: "End_Session"
}

# Action indices for easy reference
ACTION_INDICES = {v: k for k, v in ACTIONS.items()}

# Q-Learning hyperparameters
GAMMA = 0.9  # Discount factor
ALPHA = 0.1  # Learning rate
EPSILON_START = 1.0  # Initial epsilon
EPSILON_DECAY = 0.995  # Epsilon decay rate per episode
EPSILON_MIN = 0.01  # Minimum epsilon
MAX_STEPS = 30  # Maximum steps per episode
NUM_EPISODES = 1000  # Total training episodes

# Environment constraints
MAX_CONSECUTIVE_CORRECT = 5
MAX_CONSECUTIVE_WRONG = 3

# Reward values
REWARDS = {
    # Correct answers
    "correct_hard": 10,
    "correct_medium": 5,
    "correct_easy": 3,

    # Wrong answers
    "wrong": -5,

    # Topic/Knowledge events
    "topic_completion": 15,
    "level_up": 20,

    # Engagement events
    "engagement_increase": 8,
    "engagement_drop_low": -10,
    "student_quit": -15,

    # Action penalties
    "hint_penalty": -3,
    "too_easy": -8,
    "too_hard": -12,

    # Session end
    "successful_session": 50,
    "early_quit": -30,

    # Constraint violations
    "constraint_violation": -20
}

# Student response probabilities
# Probability of correct answer based on difficulty vs knowledge level
RESPONSE_PROBABILITIES = {
    "difficulty_below_knowledge": 0.8,  # Easy for Intermediate/Advanced
    "difficulty_equals_knowledge": 0.6,  # Matching difficulty
    "difficulty_above_knowledge": 0.3    # Hard for Beginner/Intermediate
}

# Engagement shift probabilities
ENGAGEMENT_PROBABILITIES = {
    "correct_increase": 0.3,  # Chance to increase engagement on correct answer
    "wrong_decrease": 0.4     # Chance to decrease engagement on wrong answer
}

# Training evaluation
EVAL_INTERVAL = 100  # Print average reward every 100 episodes
MOVING_AVERAGE_WINDOW = 50  # Window size for moving average in plotting
