import Dashboard from "@/components/Dashboard";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading Dashboard...</div>}>
      <Dashboard />
    </Suspense>
  );
}
