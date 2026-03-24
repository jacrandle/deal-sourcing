"""
Monte Carlo simulation for scoring uncertainty estimation.
Used by score.py to generate confidence intervals on composite scores.
"""

import numpy as np


def simulate_composite(
    distress: float,
    succession: float,
    moat: float,
    stability: float,
    lsg_fit: float,
    n_simulations: int = 1000,
    noise_std: float = 3.0,
    weights: dict | None = None,
) -> dict:
    """
    Run Monte Carlo simulation on dimension scores to estimate composite
    score distribution.

    Args:
        distress: Financial distress score (0-100)
        succession: Succession risk score (0-100)
        moat: Competitive moat score (0-100)
        stability: Operational stability score (0-100)
        lsg_fit: LSG strategic fit score (0-100)
        n_simulations: Number of MC iterations
        noise_std: Standard deviation of Gaussian noise applied per dimension
        weights: Dict of dimension weights (must sum to 1.0)

    Returns:
        Dict with mean, std, p10, p25, p75, p90 of simulated composite
    """
    if weights is None:
        weights = {
            "distress": 0.30,
            "succession": 0.25,
            "moat": 0.20,
            "stability": 0.15,
            "lsg_fit": 0.10,
        }

    base_scores = np.array([distress, succession, moat, stability, lsg_fit])
    weight_vec = np.array([
        weights["distress"],
        weights["succession"],
        weights["moat"],
        weights["stability"],
        weights["lsg_fit"],
    ])

    # Add Gaussian noise to each dimension across all simulations
    noise = np.random.normal(0, noise_std, size=(n_simulations, 5))
    simulated = np.clip(base_scores + noise, 0, 100)

    # Weighted composite per simulation
    composites = simulated @ weight_vec

    return {
        "mean": float(np.mean(composites)),
        "std": float(np.std(composites)),
        "p10": float(np.percentile(composites, 10)),
        "p25": float(np.percentile(composites, 25)),
        "p75": float(np.percentile(composites, 75)),
        "p90": float(np.percentile(composites, 90)),
    }


def weighted_composite(
    distress: float,
    succession: float,
    moat: float,
    stability: float,
    lsg_fit: float,
    weights: dict | None = None,
) -> float:
    """
    Deterministic weighted composite score.
    """
    if weights is None:
        weights = {
            "distress": 0.30,
            "succession": 0.25,
            "moat": 0.20,
            "stability": 0.15,
            "lsg_fit": 0.10,
        }
    return (
        distress * weights["distress"]
        + succession * weights["succession"]
        + moat * weights["moat"]
        + stability * weights["stability"]
        + lsg_fit * weights["lsg_fit"]
    )
