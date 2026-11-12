import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LocaleProvider from '../locale-provider';
import AssistantChat from './chat';
import { searchAgencyContent } from './content-agency';
import { en } from '@shared/i18n/en';

/**
 * The chat is curated, so the behaviour worth testing is not what it knows —
 * it is what it does when it does NOT know. A help panel that always produces
 * an answer is one that sometimes produces a wrong one.
 */

const entry = {
  title: 'Utilities',
  purpose: 'Municipal meters and their readings.',
  questions: [
    { q: 'Why was my reading refused?', a: 'A reading below the previous one is ambiguous.' },
    { q: 'What is the recovery gap?', a: 'Bulk against the sum of the submeters.' },
  ],
  manualAnchor: '',
  manualSection: 'Utilities',
};

const t = (key: string) => (en as Record<string, string>)[key] ?? key;

const renderChat = () =>
  render(
    <LocaleProvider>
      <AssistantChat entry={entry} />
    </LocaleProvider>,
  );

describe('assistant chat', () => {
  it('opens with the page purpose and an invitation', async () => {
    renderChat();
    expect(await screen.findByText(entry.purpose)).toBeInTheDocument();
    expect(screen.getByText(t('assistant.chat.opener'))).toBeInTheDocument();
  });

  it('answers a tapped suggestion, and stops offering it', async () => {
    const user = userEvent.setup();
    renderChat();

    const chip = screen.getByRole('button', { name: entry.questions[0].q });
    await user.click(chip);

    // The question is echoed as the reader's own turn...
    expect(screen.getAllByText(entry.questions[0].q).length).toBeGreaterThan(0);
    // ...and the curated answer follows.
    expect(await screen.findByText(entry.questions[0].a)).toBeInTheDocument();

    // Asked once, no longer suggested.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: entry.questions[0].q })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: entry.questions[1].q })).toBeInTheDocument();
  });

  it('says it does not know rather than guessing', async () => {
    const user = userEvent.setup();
    renderChat();

    await user.type(
      screen.getByRole('textbox'),
      'what is the capital of france{Enter}',
    );

    expect(await screen.findByText(t('assistant.chat.noMatch'))).toBeInTheDocument();
  });

  it('will not send an empty question', async () => {
    renderChat();
    expect(screen.getByRole('button', { name: t('assistant.chat.send') })).toBeDisabled();
  });
});

describe('curated search', () => {
  it('finds an answer from another page, with its section', () => {
    // Asked from anywhere, a meter question should reach the utilities answer.
    const hit = searchAgencyContent('my meter reading was refused', t as never);
    expect(hit).not.toBeNull();
    expect(hit!.section).toBe('Utilities');
  });

  it('returns nothing when the overlap is incidental', () => {
    expect(searchAgencyContent('what is the weather today', t as never)).toBeNull();
    expect(searchAgencyContent('', t as never)).toBeNull();
  });

  it('does not match on stopwords alone', () => {
    // Every curated question contains "the" or "a"; neither is a signal.
    expect(searchAgencyContent('the a is', t as never)).toBeNull();
  });
});
