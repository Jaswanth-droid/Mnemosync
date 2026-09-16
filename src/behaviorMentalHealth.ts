export type BehaviorType =
    | 'agitation'
    | 'sundowning'
    | 'wandering_risk'
    | 'anxiety'
    | 'confusion'
    | 'mood_swing'
    | 'apathy'
    | 'calm_lucid';

export type IncidentSeverity = 'Low' | 'Moderate' | 'Severe' | 'Critical';

export interface BehaviorIncident {
    id: string;
    timestamp: Date | string;
    timeLabel: string;
    type: BehaviorType;
    severity: IncidentSeverity;
    trigger: string;
    description: string;
    caregiverActionTaken: string;
    resolved: boolean;
}

export interface MentalHealthMetrics {
    emotionalStabilityScore: number; // 0 - 100% (Higher = More Stable)
    currentMood: 'Calm & Grounded' | 'Mild Anxiety' | 'Agitated / Restless' | 'Confused / Disoriented' | 'Apathetic / Withdrawn';
    sundowningIndex: number; // 0 - 100% (Higher = More Severe Sundowning)
    wanderingRiskScore: number; // 0 - 100% (Higher = Greater Risk of Exit Seeking)
    sleepQualityIndex: number; // 0 - 100% (Higher = Restful Sleep)
    nightAwakeningsAvg: number; // e.g. 2.4 times/night
    cognitiveStressLoad: number; // 0 - 100%
    activeAlerts: {
        id: string;
        level: 'warning' | 'critical' | 'info';
        title: string;
        message: string;
        timestamp: string;
    }[];
    caregiverRecommendations: string[];
}

export interface DailyMoodPoint {
    timeSlot: string; // '08:00', '12:00', '16:00', '19:00', '22:00', '02:00'
    moodScore: number; // 0 (Severe Distress) - 100 (Peaceful)
    agitationLevel: number; // 0 - 100
    sundowningPeak: boolean;
}

export const INITIAL_BEHAVIOR_INCIDENTS: BehaviorIncident[] = [
    {
        id: 'beh-101',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        timeLabel: '45 mins ago',
        type: 'confusion',
        severity: 'Moderate',
        trigger: 'Encounter with unfamiliar delivery personnel at door',
        description: 'Patient asked who the visitor was 4 times in 2 minutes. Mnemosync AI HUD recognized delivery and provided reassurance.',
        caregiverActionTaken: 'AI voice assistant played gentle reminder of schedule; patient settled.',
        resolved: true
    },
    {
        id: 'beh-102',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3.5).toISOString(),
        timeLabel: '3.5 hours ago',
        type: 'anxiety',
        severity: 'Low',
        trigger: 'Searching for eyeglasses on bedside table',
        description: 'Mild pacing and verbal distress regarding misplaced item.',
        caregiverActionTaken: 'Caregiver guided patient using visual marker in living room.',
        resolved: true
    },
    {
        id: 'beh-103',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        timeLabel: 'Yesterday 18:30 (Dusk)',
        type: 'sundowning',
        severity: 'Severe',
        trigger: 'Evening light transition / Twilight shadow changes',
        description: 'Marked restlessness and repetitive questioning about going to work office. Expressed belief it was 1995.',
        caregiverActionTaken: 'Turned on warm circadian lighting, played 1970s classical acoustic playlist; symptoms eased in 25 mins.',
        resolved: true
    },
    {
        id: 'beh-104',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
        timeLabel: '2 days ago 03:15 AM',
        type: 'wandering_risk',
        severity: 'Critical',
        trigger: 'Nighttime bathroom disorientation / Sleep disruption',
        description: 'Patient moved towards exterior porch exit door thinking it was the hallway bathroom.',
        caregiverActionTaken: 'Smart perimeter alert sounded gently. Caregiver redirected patient to bathroom with nightlight.',
        resolved: true
    },
    {
        id: 'beh-105',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
        timeLabel: '3 days ago 11:00 AM',
        type: 'calm_lucid',
        severity: 'Low',
        trigger: 'Memory photo album review with daughter Priya',
        description: 'High lucidity window. Patient accurately identified 5 family members and shared childhood memory of garden.',
        caregiverActionTaken: 'Logged as optimal cognitive window for reminiscence therapy.',
        resolved: true
    }
];

export const MOCK_DAILY_MOOD_CURVE: DailyMoodPoint[] = [
    { timeSlot: '08:00 AM', moodScore: 82, agitationLevel: 15, sundowningPeak: false },
    { timeSlot: '11:00 AM', moodScore: 88, agitationLevel: 12, sundowningPeak: false },
    { timeSlot: '02:00 PM', moodScore: 74, agitationLevel: 25, sundowningPeak: false },
    { timeSlot: '05:30 PM', moodScore: 48, agitationLevel: 68, sundowningPeak: true },
    { timeSlot: '08:30 PM', moodScore: 55, agitationLevel: 52, sundowningPeak: true },
    { timeSlot: '11:00 PM', moodScore: 68, agitationLevel: 30, sundowningPeak: false },
];

export const INITIAL_MENTAL_METRICS: MentalHealthMetrics = {
    emotionalStabilityScore: 68,
    currentMood: 'Calm & Grounded',
    sundowningIndex: 64,
    wanderingRiskScore: 42,
    sleepQualityIndex: 71,
    nightAwakeningsAvg: 2.3,
    cognitiveStressLoad: 58,
    activeAlerts: [
        {
            id: 'alt-1',
            level: 'warning',
            title: 'Sundowning Onset Window Approaching',
            message: 'Historical data shows mood dip between 17:00 - 19:30. Ensure ambient warm lighting is active and minimize loud stimuli.',
            timestamp: '16:00'
        },
        {
            id: 'alt-2',
            level: 'info',
            title: 'Familiar Voice Calming Protocol Active',
            message: 'Audio memory snippets from family members have reduced agitation duration by 38% this week.',
            timestamp: '14:20'
        }
    ],
    caregiverRecommendations: [
        'Maintain high ambient lighting during 17:00–20:00 to reduce sundowning shadows.',
        'Schedule demanding cognitive or medical tasks before 13:00 when lucidity is highest.',
        'Keep hallway nightlights illuminated to prevent nocturnal disorientation and wandering.',
        'Encourage 20 minutes of guided reminiscence therapy with the photo archive daily.'
    ]
};
