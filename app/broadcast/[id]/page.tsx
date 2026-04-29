'use client';

import { useParams } from 'next/navigation';
import BroadcastView from '@/components/BroadcastView';

export default function BroadcastPage() {
  const { id } = useParams();
  return <BroadcastView broadcastId={id as string} />;
}