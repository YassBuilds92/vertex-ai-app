import React from 'react';
import ReactDOM from 'react-dom/client';

import '../src/index.css';
import { MessageItem } from '../src/components/MessageItem';
import type { Message } from '../src/types';

const srtContent = [
  '1',
  '00:00:00,000 --> 00:00:02,500',
  'Premiere phrase.',
  '',
  '2',
  '00:00:02,500 --> 00:00:05,000',
  'Deuxieme phrase.',
].join('\n');

const message: Message = {
  id: 'preview-srt-message',
  role: 'model',
  content: srtContent,
  createdAt: Date.now(),
};

function Preview() {
  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-6 py-10 text-[var(--app-text)]">
      <div className="mx-auto max-w-4xl">
        <MessageItem
          msg={message}
          idx={0}
          isLast
          isLoading={false}
          isExpanded={false}
          onToggleThoughts={() => undefined}
          setSelectedImage={() => undefined}
          onEdit={() => undefined}
          onRetry={() => undefined}
        />
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Preview />);
