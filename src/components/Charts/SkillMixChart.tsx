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
    pn: number;
}

export default function SkillMixChart({ rn, pn }: SkillMixChartProps) {
    const data = {
        labels: ['RN', 'PN/NA'],
        datasets: [{
            data: [rn, pn],
            backgroundColor: ['#ec4899', '#f59e0b'],
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
