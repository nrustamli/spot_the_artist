import { useAuth } from '../contexts/AuthContext';
import './MyRewards.css';

const REWARD_MILESTONES = [
  { faces: 10, reward: 'postcard', label: 'Postcard from the Artist' },
];

function MyRewards() {
  const { user } = useAuth();
  const faces = user?.faces || 0;
  const rewards = user?.rewards || [];

  // Find the next unearned milestone (or the last one if all earned)
  const nextMilestone = REWARD_MILESTONES.find(m => faces < m.faces) || REWARD_MILESTONES[REWARD_MILESTONES.length - 1];
  const progress = Math.min((faces / nextMilestone.faces) * 100, 100);
  const allEarned = faces >= nextMilestone.faces;

  return (
    <div className="my-rewards">
      <div className="rewards-header">
        <h3 className="rewards-title">My Rewards</h3>
      </div>

      <div className="rewards-faces">
        <span className="faces-count">{faces}</span>
        <span className="faces-label">faces earned</span>
      </div>

      <div className="rewards-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-label">
          {allEarned
            ? 'All current milestones reached!'
            : `${nextMilestone.faces - faces} more faces to earn: ${nextMilestone.label}`
          }
        </div>
      </div>

      <div className="rewards-list">
        {REWARD_MILESTONES.map(milestone => {
          const earned = rewards.includes(milestone.reward);
          return (
            <div
              key={milestone.reward}
              className={`reward-card ${earned ? 'earned' : 'locked'}`}
            >
              <div className="reward-icon">
                {earned ? '\u2705' : '\uD83D\uDD12'}
              </div>
              <div className="reward-info">
                <span className="reward-name">{milestone.label}</span>
                <span className="reward-requirement">
                  {earned ? 'Earned!' : `${milestone.faces} faces`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MyRewards;
