"""
NRL Adaptive Learning System — Database Seeder

Seeds 3 CS topics and 20 real questions.
Run:  python -m backend.seed
"""

import asyncio
import random

from backend.app.core.database import init_db, async_session_factory
from backend.app.models.models import Topic, Question


TOPICS = [
    {"name": "Data Structures", "description": "Arrays, Linked Lists, Trees, Graphs, Hash Maps, Stacks, Queues", "order_index": 0},
    {"name": "Algorithms", "description": "Sorting, Searching, Dynamic Programming, Greedy, Graph Algorithms", "order_index": 1},
    {"name": "Python Fundamentals", "description": "Syntax, OOP, Data Types, Decorators, GIL, Generators", "order_index": 2},
]

QUESTIONS = [
    # ── Data Structures — Easy ────────────────────────
    {"topic": "Data Structures", "difficulty": "easy",
     "text": "What is the time complexity of accessing an element in an array by index?",
     "options": {"A": "O(1)", "B": "O(n)", "C": "O(log n)", "D": "O(n²)"},
     "correct_answer": "A",
     "explanation": "Arrays provide constant-time O(1) access by index because elements are stored contiguously in memory.",
     "hint": "Think about how arrays store elements in contiguous memory locations."},

    {"topic": "Data Structures", "difficulty": "easy",
     "text": "Which data structure follows the FIFO (First In, First Out) principle?",
     "options": {"A": "Stack", "B": "Queue", "C": "Tree", "D": "Graph"},
     "correct_answer": "B",
     "explanation": "A Queue follows FIFO — the first element added is the first one removed.",
     "hint": "Think of a line at a grocery store."},

    {"topic": "Data Structures", "difficulty": "easy",
     "text": "What does LIFO stand for in the context of stacks?",
     "options": {"A": "Last In, First Out", "B": "Last In, Fastest Out", "C": "Linked In, First Out", "D": "Linear Input, Fixed Output"},
     "correct_answer": "A",
     "explanation": "LIFO means Last In, First Out — the most recently added element is removed first.",
     "hint": "Think of a stack of plates."},

    # ── Data Structures — Medium ──────────────────────
    {"topic": "Data Structures", "difficulty": "medium",
     "text": "What is the worst-case time complexity of searching in a binary search tree?",
     "options": {"A": "O(1)", "B": "O(log n)", "C": "O(n)", "D": "O(n log n)"},
     "correct_answer": "C",
     "explanation": "In a skewed BST (essentially a linked list), search takes O(n). Balanced BSTs guarantee O(log n).",
     "hint": "Consider what happens when the tree is completely unbalanced."},

    {"topic": "Data Structures", "difficulty": "medium",
     "text": "Which data structure is best for implementing a priority queue?",
     "options": {"A": "Array", "B": "Linked List", "C": "Heap", "D": "Stack"},
     "correct_answer": "C",
     "explanation": "Heaps provide O(log n) insert and O(1) access to the min/max element.",
     "hint": "This structure maintains a special ordering between parent and child nodes."},

    # ── Data Structures — Hard ────────────────────────
    {"topic": "Data Structures", "difficulty": "hard",
     "text": "What is the amortized time complexity of inserting into a dynamic array (e.g., Python list)?",
     "options": {"A": "O(1)", "B": "O(n)", "C": "O(log n)", "D": "O(n²)"},
     "correct_answer": "A",
     "explanation": "While occasional resizing costs O(n), the amortized cost per insertion is O(1) due to the doubling strategy.",
     "hint": "Consider the doubling strategy and how resize cost is spread."},

    {"topic": "Data Structures", "difficulty": "hard",
     "text": "In a Red-Black tree, what is the maximum height relative to n nodes?",
     "options": {"A": "log n", "B": "2 log(n+1)", "C": "n/2", "D": "√n"},
     "correct_answer": "B",
     "explanation": "Red-Black trees guarantee height ≤ 2·log₂(n+1), ensuring O(log n) operations.",
     "hint": "Red-Black trees are a type of self-balancing BST."},

    # ── Algorithms — Easy ─────────────────────────────
    {"topic": "Algorithms", "difficulty": "easy",
     "text": "What is the time complexity of linear search?",
     "options": {"A": "O(1)", "B": "O(log n)", "C": "O(n)", "D": "O(n²)"},
     "correct_answer": "C",
     "explanation": "Linear search checks each element one by one, taking O(n) in the worst case.",
     "hint": "You check every element from start to end."},

    {"topic": "Algorithms", "difficulty": "easy",
     "text": "Which sorting algorithm has the best average-case time complexity?",
     "options": {"A": "Bubble Sort - O(n²)", "B": "Merge Sort - O(n log n)", "C": "Selection Sort - O(n²)", "D": "Insertion Sort - O(n²)"},
     "correct_answer": "B",
     "explanation": "Merge Sort consistently achieves O(n log n) through divide-and-conquer.",
     "hint": "Think about divide-and-conquer algorithms."},

    # ── Algorithms — Medium ───────────────────────────
    {"topic": "Algorithms", "difficulty": "medium",
     "text": "What technique does binary search use?",
     "options": {"A": "Brute Force", "B": "Divide and Conquer", "C": "Dynamic Programming", "D": "Backtracking"},
     "correct_answer": "B",
     "explanation": "Binary search divides the search space in half at each step.",
     "hint": "The search space is repeatedly halved."},

    {"topic": "Algorithms", "difficulty": "medium",
     "text": "What is the space complexity of merge sort?",
     "options": {"A": "O(1)", "B": "O(log n)", "C": "O(n)", "D": "O(n²)"},
     "correct_answer": "C",
     "explanation": "Merge sort requires O(n) additional space for temporary arrays during merging.",
     "hint": "Merging requires temporary storage for combined results."},

    {"topic": "Algorithms", "difficulty": "medium",
     "text": "What is the time complexity of Dijkstra's shortest path algorithm with a min-heap?",
     "options": {"A": "O(V²)", "B": "O(V + E)", "C": "O((V + E) log V)", "D": "O(V·E)"},
     "correct_answer": "C",
     "explanation": "With a binary min-heap, Dijkstra runs in O((V + E) log V) time.",
     "hint": "The priority queue operations dominate the runtime."},

    # ── Algorithms — Hard ─────────────────────────────
    {"topic": "Algorithms", "difficulty": "hard",
     "text": "What is the time complexity of the Bellman-Ford algorithm?",
     "options": {"A": "O(V log V)", "B": "O(V·E)", "C": "O(V²)", "D": "O(E log V)"},
     "correct_answer": "B",
     "explanation": "Bellman-Ford relaxes all E edges V-1 times, giving O(V·E). It handles negative weights unlike Dijkstra.",
     "hint": "The algorithm iterates V-1 times, relaxing all edges each iteration."},

    # ── Python — Easy ─────────────────────────────────
    {"topic": "Python Fundamentals", "difficulty": "easy",
     "text": "What is the output of: print(type([1, 2, 3]))?",
     "options": {"A": "<class 'tuple'>", "B": "<class 'list'>", "C": "<class 'set'>", "D": "<class 'dict'>"},
     "correct_answer": "B",
     "explanation": "Square brackets [] create a list in Python.",
     "hint": "Look at the brackets used — [] vs () vs {}."},

    {"topic": "Python Fundamentals", "difficulty": "easy",
     "text": "Which keyword is used to define a function in Python?",
     "options": {"A": "func", "B": "function", "C": "def", "D": "define"},
     "correct_answer": "C",
     "explanation": "The 'def' keyword is used to define functions in Python.",
     "hint": "It's a short, 3-letter keyword."},

    # ── Python — Medium ───────────────────────────────
    {"topic": "Python Fundamentals", "difficulty": "medium",
     "text": "What is the difference between a list and a tuple in Python?",
     "options": {"A": "Lists are immutable, tuples are mutable", "B": "Lists are mutable, tuples are immutable",
                 "C": "There is no difference", "D": "Tuples can only store numbers"},
     "correct_answer": "B",
     "explanation": "Lists are mutable (can be changed), while tuples are immutable (fixed after creation).",
     "hint": "Think about which one you can modify after creation."},

    {"topic": "Python Fundamentals", "difficulty": "medium",
     "text": "What does the 'yield' keyword do in Python?",
     "options": {"A": "Terminates the function", "B": "Creates a generator function",
                 "C": "Imports a module", "D": "Defines a class method"},
     "correct_answer": "B",
     "explanation": "The 'yield' keyword turns a function into a generator, allowing lazy iteration.",
     "hint": "It's related to generators and lazy evaluation."},

    # ── Python — Hard ─────────────────────────────────
    {"topic": "Python Fundamentals", "difficulty": "hard",
     "text": "What is a decorator in Python?",
     "options": {"A": "A function that modifies another function's behavior", "B": "A class inheriting from another",
                 "C": "A type of loop", "D": "A method to format strings"},
     "correct_answer": "A",
     "explanation": "Decorators wrap functions to extend their behavior without modifying source code. Used with @syntax.",
     "hint": "Think of @property or @staticmethod."},

    {"topic": "Python Fundamentals", "difficulty": "hard",
     "text": "What does the GIL (Global Interpreter Lock) do in CPython?",
     "options": {"A": "Prevents multiple threads from executing Python bytecode simultaneously",
                 "B": "Locks global variables from modification",
                 "C": "Manages memory allocation globally",
                 "D": "Encrypts global data"},
     "correct_answer": "A",
     "explanation": "The GIL ensures only one thread executes Python bytecode at a time, limiting CPU-bound parallelism.",
     "hint": "It's related to threading and concurrency limitations."},
]


async def seed():
    await init_db()

    async with async_session_factory() as session:
        # Check if already seeded
        from sqlalchemy import select, func
        count_result = await session.execute(select(func.count(Topic.id)))
        if count_result.scalar() > 0:
            print("[OK] Database already seeded. Skipping.")
            return

        # Create topics
        topic_map = {}
        for t in TOPICS:
            topic = Topic(**t)
            session.add(topic)
            topic_map[t["name"]] = topic

        await session.flush()

        # Create questions
        for q_data in QUESTIONS:
            topic_name = q_data.pop("topic")
            question = Question(topic_id=topic_map[topic_name].id, **q_data)
            session.add(question)

        await session.commit()
        print(f"[OK] Seeded {len(TOPICS)} topics and {len(QUESTIONS)} questions.")


if __name__ == "__main__":
    asyncio.run(seed())
