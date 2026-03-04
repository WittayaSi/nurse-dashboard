'use client';
import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SkillMixChartProps {
    rn: number;
    nonRn: number;
    hn?: number;
    rnOnly?: number;
    pn?: number;
    na?: number;
}

export default function SkillMixChart({ rn, nonRn, hn, rnOnly, pn, na }: SkillMixChartProps) {
    const isDetailed = hn !== undefined && rnOnly !== undefined && pn !== undefined && na !== undefined;

    // Detailed colors: HN (Indigo), RN (Pink), PN (Teal), NA (Amber)
    const labels = isDetailed ? ['HN', 'RN', 'PN', 'NA'] : ['RN', 'Non-RN'];
    const dataValues = isDetailed ? [hn, rnOnly, pn, na] : [rn, nonRn];
    const bgColors = isDetailed ? ['#4f46e5', '#ec4899', '#0d9488', '#f59e0b'] : ['#ec4899', '#f59e0b'];

    const data = {
        labels,
        datasets: [{
            data: dataValues,
            backgroundColor: bgColors,
            borderWidth: 0
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: { legend: { display: false } }
    };

    return <Doughnut data={data} options={options} />;
}
