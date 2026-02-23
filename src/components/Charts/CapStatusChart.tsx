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

interface CapStatusChartProps {
    capData: { suitable: number; improve: number; shortage: number };
}

export default function CapStatusChart({ capData }: CapStatusChartProps) {
    const data = {
        labels: ['เหมาะสม (Suitable)', 'ปรับปรุง (Improve)', 'ขาดแคลน (Shortage)'],
        datasets: [{
            data: [capData.suitable, capData.improve, capData.shortage],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderRadius: 8,
            barThickness: 50
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { display: false, beginAtZero: true },
            x: { grid: { display: false } }
        }
    };

    return <Bar data={data} options={options} />;
}
