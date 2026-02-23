'use client';
import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface WardChartProps {
    wardData: { name: string; prod: number }[];
    deptType: 'IPD' | 'OPD';
}

export default function WardChart({ wardData, deptType }: WardChartProps) {
    const colors = wardData.map(d => {
        if (d.prod >= 100) return '#6366f1';
        if (d.prod >= 85) return '#10b981';
        return '#f87171';
    });

    const data = {
        labels: wardData.map(d => d.name),
        datasets: [{
            label: 'Productivity %',
            data: wardData.map(d => d.prod),
            backgroundColor: colors,
            borderRadius: 6
        }]
    };

    const options = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { 
                grid: { color: '#f3f4f6' },
                max: 120,
                ticks: { callback: (v: any) => v + '%' }
            },
            y: { grid: { display: false } }
        }
    };

    return <Bar data={data} options={options} />;
}
