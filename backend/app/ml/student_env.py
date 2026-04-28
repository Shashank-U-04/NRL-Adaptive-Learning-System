"""
Student Learning Environment - A Gym-like environment for RL-based personalized learning.

This environment simulates a student's learning process with state transitions,
reward mechanisms, and constraints that an RL agent must learn to navigate.
"""

import numpy as np
import random
from typing import Tuple, Dict, Any
from backend.app.ml.config import (
    KNOWLEDGE_LEVELS, TOPICS, QUESTION_DIFFICULTIES, ENGAGEMENT_LEVELS, ACTIONS,
    ACTION_INDICES, REWARDS, RESPONSE_PROBABILITIES, ENGAGEMENT_PROBABILITIES,
    MAX_CONSECUTIVE_CORRECT, MAX_CONSECUTIVE_WRONG
)


class StudentLearningEnv:
    """
    A Gym-like environment simulating student learning dynamics.

    State: (knowledge_level, current_topic, question_difficulty, consecutive_correct,
            consecutive_wrong, engagement_score)

    Actions: 0-6 (Present_Easy_Question, Present_Medium_Question, Present_Hard_Question,
                  Give_Hint, Review_Previous_Topic, Move_To_Next_Topic, End_Session)
    """

    def __init__(self):
        """Initialize the student learning environment."""
        # State: (knowledge_level, current_topic, question_difficulty,
        #         consecutive_correct, consecutive_wrong, engagement_score)
        self.state = None
        self.reset()

    def reset(self) -> Tuple[int, int, int, int, int, int]:
        """
        Reset the environment to initial state.

        Returns:
            Initial state tuple
        """
        # Start with beginner knowledge, topic 0, easy questions, no streaks, medium engagement
        self.state = (0, 0, 0, 0, 0, 1)  # knowledge_level, topic, difficulty, correct_streak, wrong_streak, engagement
        return self.state

    def step(self, action: int) -> Tuple[Tuple, float, bool, Dict[str, Any]]:
        """
        Execute one step in the environment.

        Args:
            action: Action index (0-6)

        Returns:
            next_state: New state tuple
            reward: Reward for this action
            done: Whether episode is finished
            info: Additional information dict
        """
        if not self._is_action_valid(action):
            # Constraint violation - heavy penalty and no state change
            reward = REWARDS["constraint_violation"]
            done = False
            info = {"violation": True, "reason": self._get_violation_reason(action)}
            return self.state, reward, done, info

        # Execute the action and get reward
        reward, done, info = self._execute_action(action)

        # Update state based on student response and environment dynamics
        self._update_state(action)

        return self.state, reward, done, info

    def _is_action_valid(self, action: int) -> bool:
        """
        Check if an action violates any constraints.

        Returns:
            True if action is valid, False otherwise
        """
        knowledge_level, current_topic, _, consecutive_correct, _, _ = self.state

        if action == ACTION_INDICES["Present_Hard_Question"] and knowledge_level == 0:
            # Cannot give hard questions to beginners
            return False

        if action == ACTION_INDICES["Move_To_Next_Topic"] and consecutive_correct < 3:
            # Must have 3 consecutive correct answers to move to next topic
            return False

        if action == ACTION_INDICES["Review_Previous_Topic"] and current_topic == 0:
            # Cannot review previous topic when on topic 0
            return False

        return True

    def _get_violation_reason(self, action: int) -> str:
        """Get the reason for action constraint violation."""
        knowledge_level, current_topic, _, consecutive_correct, _, _ = self.state

        if action == ACTION_INDICES["Present_Hard_Question"] and knowledge_level == 0:
            return "Cannot present hard questions to beginners"
        elif action == ACTION_INDICES["Move_To_Next_Topic"] and consecutive_correct < 3:
            return f"Need {3 - consecutive_correct} more consecutive correct answers to advance"
        elif action == ACTION_INDICES["Review_Previous_Topic"] and current_topic == 0:
            return "Cannot review previous topic when on first topic"
        return "Unknown constraint violation"

    def _execute_action(self, action: int) -> Tuple[float, bool, Dict[str, Any]]:
        """
        Execute the action and calculate reward.

        Returns:
            reward: Calculated reward
            done: Whether episode should end
            info: Additional information
        """
        reward = 0
        done = False
        info = {"action": ACTIONS[action], "student_response": None}

        if action <= 2:  # Present question actions (0: Easy, 1: Medium, 2: Hard)
            reward, done, info = self._handle_question_action(action)

        elif action == ACTION_INDICES["Give_Hint"]:
            reward = REWARDS["hint_penalty"]
            info["hint_given"] = True

        elif action == ACTION_INDICES["Review_Previous_Topic"]:
            # Move to previous topic, reset streaks
            knowledge_level, current_topic, difficulty, _, _, engagement = self.state
            new_topic = max(0, current_topic - 1)
            self.state = (knowledge_level, new_topic, difficulty, 0, 0, engagement)
            info["topic_reviewed"] = True

        elif action == ACTION_INDICES["Move_To_Next_Topic"]:
            # Move to next topic, reset streaks, potential topic completion reward
            knowledge_level, current_topic, difficulty, _, _, engagement = self.state
            new_topic = min(2, current_topic + 1)
            topic_completed = new_topic > current_topic
            self.state = (knowledge_level, new_topic, difficulty, 0, 0, engagement)

            if topic_completed:
                reward += REWARDS["topic_completion"]
                info["topic_completed"] = True

        elif action == ACTION_INDICES["End_Session"]:
            # End session - check if successful
            _, _, _, _, _, engagement = self.state
            _, _, _, consecutive_correct, _, _ = self.state

            if engagement == 2 and consecutive_correct >= 3:  # High engagement and topic mastery
                reward = REWARDS["successful_session"]
                info["session_successful"] = True
            else:
                reward = REWARDS["early_quit"]
                info["early_quit"] = True
            done = True

        return reward, done, info

    def _handle_question_action(self, action: int) -> Tuple[float, bool, Dict[str, Any]]:
        """Handle presenting a question and getting student response."""
        knowledge_level, current_topic, difficulty, consecutive_correct, consecutive_wrong, engagement = self.state
        question_difficulty = action  # 0: Easy, 1: Medium, 2: Hard

        # Simulate student response based on difficulty vs knowledge
        is_correct = self._simulate_student_response(question_difficulty, knowledge_level)

        reward = 0
        done = False
        info = {
            "question_difficulty": QUESTION_DIFFICULTIES[question_difficulty],
            "student_response": "correct" if is_correct else "wrong"
        }

        # Update streaks and check for knowledge advancement
        level_up = False
        if is_correct:
            new_consecutive_correct = consecutive_correct + 1
            new_consecutive_wrong = 0

            # Reward based on difficulty
            if question_difficulty == 2:  # Hard
                reward += REWARDS["correct_hard"]
            elif question_difficulty == 1:  # Medium
                reward += REWARDS["correct_medium"]
            else:  # Easy
                reward += REWARDS["correct_easy"]

            # Check for question too easy penalty
            if question_difficulty < knowledge_level:
                reward += REWARDS["too_easy"]
                info["too_easy"] = True

            # Check for knowledge level advancement (3 consecutive correct answers)
            if new_consecutive_correct >= 3:
                new_knowledge_level = min(2, knowledge_level + 1)
                if new_knowledge_level > knowledge_level:
                    level_up = True
                    reward += REWARDS["level_up"]
                    info["level_up"] = True
                    new_consecutive_correct = 0  # Reset streak after level up
                knowledge_level = new_knowledge_level
        else:
            new_consecutive_correct = 0
            new_consecutive_wrong = consecutive_wrong + 1

            # Wrong answer penalty
            reward += REWARDS["wrong"]

            # Check for question too hard penalty
            if question_difficulty > knowledge_level:
                reward += REWARDS["too_hard"]
                info["too_hard"] = True

            # Check for dropout (3 consecutive wrong answers)
            if new_consecutive_wrong >= MAX_CONSECUTIVE_WRONG:
                reward += REWARDS["student_quit"]
                done = True
                info["dropout"] = True

        # Update engagement based on response
        engagement_change = self._update_engagement(is_correct, new_consecutive_correct, new_consecutive_wrong)
        if engagement_change > 0:
            reward += REWARDS["engagement_increase"]
            info["engagement_increased"] = True
        elif engagement_change < 0 and engagement + engagement_change == 0:  # Engagement dropped to low
            reward += REWARDS["engagement_drop_low"]
            info["engagement_dropped_low"] = True

        # Update state with new values
        self.state = (knowledge_level, current_topic, question_difficulty,
                     new_consecutive_correct, new_consecutive_wrong, self.state[5])

        return reward, done, info

    def _simulate_student_response(self, question_difficulty: int, knowledge_level: int) -> bool:
        """
        Simulate whether the student answers correctly based on difficulty vs knowledge.

        Returns:
            True if correct, False if wrong
        """
        if question_difficulty < knowledge_level:
            prob_correct = RESPONSE_PROBABILITIES["difficulty_below_knowledge"]
        elif question_difficulty == knowledge_level:
            prob_correct = RESPONSE_PROBABILITIES["difficulty_equals_knowledge"]
        else:
            prob_correct = RESPONSE_PROBABILITIES["difficulty_above_knowledge"]

        return random.random() < prob_correct

    def _update_engagement(self, is_correct: bool, new_consecutive_correct: int, new_consecutive_wrong: int) -> int:
        """
        Update engagement level based on student response.

        Args:
            is_correct: Whether the student's answer was correct
            new_consecutive_correct: Updated consecutive correct count
            new_consecutive_wrong: Updated consecutive wrong count

        Returns:
            Change in engagement level (-1, 0, or 1)
        """
        knowledge_level, current_topic, difficulty, consecutive_correct, consecutive_wrong, engagement = self.state

        change = 0

        if is_correct and random.random() < ENGAGEMENT_PROBABILITIES["correct_increase"]:
            change = 1  # Increase engagement
        elif not is_correct and random.random() < ENGAGEMENT_PROBABILITIES["wrong_decrease"]:
            change = -1  # Decrease engagement

        # Update engagement level (clamp between 0 and 2)
        new_engagement = max(0, min(2, engagement + change))

        # Update the state with new engagement (keeping other values as they were updated in _handle_question_action)
        self.state = (self.state[0], self.state[1], self.state[2],
                     new_consecutive_correct, new_consecutive_wrong, new_engagement)

        return change

    def _update_state(self, action: int):
        """Update the environment state based on action and student dynamics."""
        # State updates are now handled within _execute_action and _handle_question_action
        # This method is kept for potential future extensions
        pass

    def render(self):
        """Render the current state of the environment."""
        knowledge_level, current_topic, difficulty, consecutive_correct, consecutive_wrong, engagement = self.state

        print(f"""
Student Learning Environment State:
- Knowledge Level: {KNOWLEDGE_LEVELS[knowledge_level]}
- Current Topic: {TOPICS[current_topic]}
- Question Difficulty: {QUESTION_DIFFICULTIES[difficulty]}
- Consecutive Correct: {consecutive_correct}
- Consecutive Wrong: {consecutive_wrong}
- Engagement: {ENGAGEMENT_LEVELS[engagement]}
        """)

    def get_state_space_size(self) -> int:
        """Get the total number of possible states."""
        # 3 knowledge levels × 3 topics × 3 difficulties × 6 correct streaks × 4 wrong streaks × 3 engagement levels
        return 3 * 3 * 3 * (MAX_CONSECUTIVE_CORRECT + 1) * (MAX_CONSECUTIVE_WRONG + 1) * 3

    def get_action_space_size(self) -> int:
        """Get the number of possible actions."""
        return len(ACTIONS)
