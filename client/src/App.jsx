import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import ReviewPage from './routes/ReviewPage.jsx';
import HistoryPage from './routes/HistoryPage.jsx';
import StatsPage from './routes/StatsPage.jsx';

export default function App() {
  return <Routes><Route element={<AppLayout />}><Route index element={<ReviewPage />} /><Route path="review/:id" element={<ReviewPage />} /><Route path="history" element={<HistoryPage />} /><Route path="stats" element={<StatsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes>;
}
