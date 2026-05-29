"""
DQN integration point for future neural policy.

When a trained model file exists at ``RL_MODEL_PATH``, ``AdaptiveEngine``
automatically loads and uses it via the ``DQN`` class from
``app.ml.dqn_model``.

To train (from the ``backend/`` directory, with a venv that has torch
installed):

    python -m app.ml.train_dqn --episodes 50    # quick smoke run
    python -m app.ml.train_dqn                  # default 800 episodes

The DQN input is a 7-float state vector encoded by
``app.ml.dqn_model.encode_state``:

    quiz_accuracy, mcq_accuracy, lab_success_rate, recent_trend,
    attempts_count, avg_response_time, topic_confidence

The DQN output is 7 Q-values corresponding to ``app.adaptive.rules.ACTIONS``.
"""
