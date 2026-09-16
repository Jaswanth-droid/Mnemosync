export interface ProgressionRecord {
    id: string;
    date: string; // YYYY-MM-DD
    timestamp: number;
    cdrScore: number; // 0.0, 0.5, 1.0, 2.0, 3.0
    cdrStage: 'Normal' | 'Questionable/Very Mild' | 'Mild Dementia' | 'Moderate Dementia' | 'Severe Dementia';
    fastStage: number; // 1 to 7
    fastDescription: string;
    mmseEstimated: number; // 0 - 30
    severityIndex: number; // 0 - 100% (Higher = More Severe)
    memoryRetention: number; // 0 - 100%
    facialRecognitionScore: number; // 0 - 100%
    executiveFunctionScore: number; // 0 - 100%
    languageFluencyScore: number; // 0 - 100%
    spatialOrientationScore: number; // 0 - 100%
    dailyIndependenceScore: number; // 0 - 100%
    notes: string;
}

export interface ProgressionForecast {
    monthOffset: number;
    monthLabel: string;
    projectedSeverity: number;
    projectedMMSE: number;
    confidenceLow: number;
    confidenceHigh: number;
    riskAlert?: string;
}

export interface ClinicalStageSummary {
    cdrScore: number;
    cdrLabel: string;
    fastStage: number;
    fastLabel: string;
    severityPercentage: number;
    velocityLabel: 'Stable' | 'Gradual Decline' | 'Accelerated Progression';
    velocityRate: number; // % per month
    nextMilestoneRisk: string;
    supervisionRequirement: 'Independent' | 'Intermittent Check-ins' | 'Constant Daytime Care' | '24/7 Total Nursing Care';
}

// Staging helper
export function getCDRDetails(cdr: number): { label: ProgressionRecord['cdrStage']; description: string } {
    if (cdr <= 0.25) {
        return { label: 'Normal', description: 'No cognitive decline or memory impairment.' };
    } else if (cdr <= 0.75) {
        return { label: 'Questionable/Very Mild', description: 'Slight, consistent forgetfulness; partial recollection of events; benign memory loss.' };
    } else if (cdr <= 1.5) {
        return { label: 'Mild Dementia', description: 'Moderate memory loss, more marked for recent events; interferes with everyday activities.' };
    } else if (cdr <= 2.5) {
        return { label: 'Moderate Dementia', description: 'Severe memory loss; only highly learned material retained; new material lost rapidly; disoriented to time/place.' };
    } else {
        return { label: 'Severe Dementia', description: 'Severe memory loss; only fragments remain; unable to function independently.' };
    }
}

export function getFASTDetails(fast: number): string {
    switch (Math.round(fast)) {
        case 1: return 'Normal Adult - No functional deficits';
        case 2: return 'Normal Older Adult - Subjective word-finding difficulty';
        case 3: return 'Early MCI - Decreased capacity in demanding work/travel';
        case 4: return 'Mild Dementia - Decreased ability in complex tasks (finances, planning)';
        case 5: return 'Moderate Dementia - Requires assistance in choosing proper attire';
        case 6: return 'Moderately Severe - Requires assistance in dressing/bathing/toileting';
        case 7: return 'Severe Dementia - Very limited speech, loss of motor control';
        default: return 'Functional decline stage assessment in progress';
    }
}

// Initial 6-month clinical baseline progression data for patient
export const INITIAL_PROGRESSION_HISTORY: ProgressionRecord[] = [
    {
        id: 'prog-m6',
        date: '2026-03-15',
        timestamp: new Date('2026-03-15').getTime(),
        cdrScore: 0.5,
        cdrStage: 'Questionable/Very Mild',
        fastStage: 3,
        fastDescription: 'Early MCI - Occasional appointments missed, mild word retrieval delay',
        mmseEstimated: 26,
        severityIndex: 28,
        memoryRetention: 82,
        facialRecognitionScore: 92,
        executiveFunctionScore: 78,
        languageFluencyScore: 84,
        spatialOrientationScore: 88,
        dailyIndependenceScore: 85,
        notes: 'Initial clinical baseline. Patient showed mild short-term memory lapses during complex schedule review.'
    },
    {
        id: 'prog-m5',
        date: '2026-04-15',
        timestamp: new Date('2026-04-15').getTime(),
        cdrScore: 0.5,
        cdrStage: 'Questionable/Very Mild',
        fastStage: 3.2,
        fastDescription: 'Early MCI - Mild difficulty recalling remote details, minor spatial hesitation',
        mmseEstimated: 25,
        severityIndex: 32,
        memoryRetention: 78,
        facialRecognitionScore: 89,
        executiveFunctionScore: 74,
        languageFluencyScore: 81,
        spatialOrientationScore: 84,
        dailyIndependenceScore: 80,
        notes: 'Slight increase in reminder prompts required for medications. Visual cues helpful.'
    },
    {
        id: 'prog-m4',
        date: '2026-05-15',
        timestamp: new Date('2026-05-15').getTime(),
        cdrScore: 1.0,
        cdrStage: 'Mild Dementia',
        fastStage: 4,
        fastDescription: 'Mild Dementia - Difficulty with financial calculations, occasional confusion on dates',
        mmseEstimated: 23,
        severityIndex: 42,
        memoryRetention: 70,
        facialRecognitionScore: 82,
        executiveFunctionScore: 65,
        languageFluencyScore: 76,
        spatialOrientationScore: 78,
        dailyIndependenceScore: 72,
        notes: 'Transitioned to CDR 1.0. Moderate recent memory decay. Mnemosync AI HUD actively logging familiar visitors.'
    },
    {
        id: 'prog-m3',
        date: '2026-06-15',
        timestamp: new Date('2026-06-15').getTime(),
        cdrScore: 1.0,
        cdrStage: 'Mild Dementia',
        fastStage: 4.2,
        fastDescription: 'Mild Dementia - Needs structured daily itinerary, responds well to face recognition overlays',
        mmseEstimated: 22,
        severityIndex: 46,
        memoryRetention: 65,
        facialRecognitionScore: 78,
        executiveFunctionScore: 61,
        languageFluencyScore: 72,
        spatialOrientationScore: 74,
        dailyIndependenceScore: 68,
        notes: 'Caregiver intervention logged for evening orientation. Mnemosync voice recall actively utilized.'
    },
    {
        id: 'prog-m2',
        date: '2026-07-15',
        timestamp: new Date('2026-07-15').getTime(),
        cdrScore: 1.0,
        cdrStage: 'Mild Dementia',
        fastStage: 4.5,
        fastDescription: 'Mild to Moderate Stage - Periodic recognition lag with distant relatives, mild sundowning',
        mmseEstimated: 21,
        severityIndex: 51,
        memoryRetention: 60,
        facialRecognitionScore: 75,
        executiveFunctionScore: 56,
        languageFluencyScore: 68,
        spatialOrientationScore: 69,
        dailyIndependenceScore: 62,
        notes: 'Recognition cues needed for visiting colleagues. Conversational assist reduced repetitive queries by 40%.'
    },
    {
        id: 'prog-m1',
        date: '2026-08-15',
        timestamp: new Date('2026-08-15').getTime(),
        cdrScore: 1.0,
        cdrStage: 'Mild Dementia',
        fastStage: 4.7,
        fastDescription: 'Mild Dementia (Progressive) - Stable with assistive companion HUD, motor skills intact',
        mmseEstimated: 20,
        severityIndex: 54,
        memoryRetention: 56,
        facialRecognitionScore: 72,
        executiveFunctionScore: 52,
        languageFluencyScore: 65,
        spatialOrientationScore: 66,
        dailyIndependenceScore: 58,
        notes: 'Consistent engagement maintained. Behavioral rhythm stable when daily prompts are followed.'
    },
    {
        id: 'prog-current',
        date: '2026-09-15',
        timestamp: new Date('2026-09-15').getTime(),
        cdrScore: 1.2,
        cdrStage: 'Mild Dementia',
        fastStage: 4.8,
        fastDescription: 'Mild-Moderate Threshold - High benefit from real-time biometric HUD and memory prompts',
        mmseEstimated: 19,
        severityIndex: 57,
        memoryRetention: 53,
        facialRecognitionScore: 70,
        executiveFunctionScore: 49,
        languageFluencyScore: 62,
        spatialOrientationScore: 63,
        dailyIndependenceScore: 54,
        notes: 'Current Clinical Audit: Memory degradation velocity currently at +2.1%/mo (Gradual). Immediate caregiver alerts active.'
    }
];

// Calculate clinical velocity & stage summary
export function computeClinicalSummary(history: ProgressionRecord[]): ClinicalStageSummary {
    if (!history || history.length === 0) {
        return {
            cdrScore: 1.0,
            cdrLabel: 'Mild Dementia',
            fastStage: 4.0,
            fastLabel: 'Mild Dementia',
            severityPercentage: 50,
            velocityLabel: 'Gradual Decline',
            velocityRate: 2.0,
            nextMilestoneRisk: 'Transition to Moderate Dementia (CDR 2.0) estimated within 9-14 months without cognitive stimulation.',
            supervisionRequirement: 'Intermittent Check-ins'
        };
    }

    const latest = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : latest;

    const deltaSeverity = latest.severityIndex - previous.severityIndex;
    let velocityLabel: 'Stable' | 'Gradual Decline' | 'Accelerated Progression' = 'Gradual Decline';
    if (deltaSeverity < 1.0) velocityLabel = 'Stable';
    else if (deltaSeverity > 4.0) velocityLabel = 'Accelerated Progression';

    let supervision: ClinicalStageSummary['supervisionRequirement'] = 'Intermittent Check-ins';
    if (latest.cdrScore < 0.5) supervision = 'Independent';
    else if (latest.cdrScore >= 2.0) supervision = '24/7 Total Nursing Care';
    else if (latest.cdrScore >= 1.5) supervision = 'Constant Daytime Care';

    const cdrDetails = getCDRDetails(latest.cdrScore);

    return {
        cdrScore: latest.cdrScore,
        cdrLabel: cdrDetails.label,
        fastStage: latest.fastStage,
        fastLabel: getFASTDetails(latest.fastStage),
        severityPercentage: latest.severityIndex,
        velocityLabel,
        velocityRate: Math.max(0.5, parseFloat(deltaSeverity.toFixed(1))),
        nextMilestoneRisk: latest.severityIndex > 55 
            ? 'Caregiver Alert: Episodic memory degradation requires visual prompts during unfamiliar guest visits and medication intervals.'
            : 'Early Stage: Cognitive exercises and structured reminders recommended to maintain retention curve.',
        supervisionRequirement: supervision
    };
}

// Forecast 12-month trajectory
export function calculateFutureForecasts(latest: ProgressionRecord, velocityPerMonth: number): ProgressionForecast[] {
    const months = [
        { offset: 1, label: '+1 Mo (Oct)' },
        { offset: 3, label: '+3 Mo (Dec)' },
        { offset: 6, label: '+6 Mo (Mar 2027)' },
        { offset: 9, label: '+9 Mo (Jun 2027)' },
        { offset: 12, label: '+12 Mo (Sep 2027)' }
    ];

    return months.map(m => {
        const projSev = Math.min(100, Math.round(latest.severityIndex + (velocityPerMonth * m.offset)));
        const projMMSE = Math.max(5, Math.round(latest.mmseEstimated - (0.4 * m.offset)));
        const spread = m.offset * 1.8;

        let riskAlert: string | undefined;
        if (m.offset >= 6 && projSev > 65) {
            riskAlert = 'Threshold for Assisted Living / 24h Supervision recommended';
        } else if (m.offset >= 3 && projSev > 58) {
            riskAlert = 'Increased Sundowning & Wandering Risk Window';
        }

        return {
            monthOffset: m.offset,
            monthLabel: m.label,
            projectedSeverity: projSev,
            projectedMMSE: projMMSE,
            confidenceLow: Math.max(10, Math.round(projSev - spread)),
            confidenceHigh: Math.min(100, Math.round(projSev + spread)),
            riskAlert
        };
    });
}
