import React from 'react';

export const formatContent = (text: string) => text.split('\n').map((line, i) => {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  const regex = /\*\*(.*?)\*\*/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIdx) parts.push(line.slice(lastIdx, match.index));
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < line.length) parts.push(line.slice(lastIdx));
  return <span key={i}>{i > 0 && <br />}{parts}</span>;
});
