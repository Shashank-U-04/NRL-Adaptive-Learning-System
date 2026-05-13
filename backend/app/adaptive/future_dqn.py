"""
DQN integration point for future neural policy.

When a trained model file exists at RL_MODEL_PATH, AdaptiveEngine
automatically loads and uses it via DQN class from dqn_model.py.

To train:
  python backend/train_dqn.py --episodes 1000

To evaluate:
  python backend/train_dqn.py --eval-only

The DQN input is a 7-float state vector (see adaptive/rules.py initial_state).
The DQN output is 7 Q-values corresponding to ACTIONS.
"""
