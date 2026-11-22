import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getReply, toSearchQuery } from '../../../src/lib/ui/chatbot';
import type { BotReply, BotRule } from '../../../src/config/chatbot';

const r = (emoji: string): BotReply => ({ emoji });
const rules: BotRule[] = [
  { keywords: ['hi', 'hello'], replies: [r('👋')] },
  { keywords: ['thank'], replies: [r('🙏')] },
  { keywords: ['cat', 'dog'], replies: [r('🐱')] },
];
const brain = { rules, question: [r('🤔')], fallback: [r('🤷')] };
const first = () => 0;

describe('getReply', () => {
  it('matches keywords by prefix, and short ones exactly (or plural)', () => {
    assert.equal(getReply('Thanks a lot!', brain, first).emoji, '🙏');
    assert.equal(getReply('thank-you', brain, first).emoji, '🙏');
    assert.equal(getReply('hello there', brain, first).emoji, '👋');
    assert.equal(getReply('cats', brain, first).emoji, '🐱');
    assert.equal(getReply('this', brain, first).emoji, '🤷'); // "hi" is not a prefix match
  });
  it('the rule with the most matching words wins; ties go to the earlier rule', () => {
    assert.equal(getReply('hi cat dog', brain, first).emoji, '🐱');
    assert.equal(getReply('hi cat', brain, first).emoji, '👋');
  });
  it('echoes emoji when nothing else matches', () => {
    assert.deepEqual(getReply('🔥🔥🔥🔥', brain, first), { emoji: '🔥🔥🔥❗', motion: 'bounce' });
  });
  it('answers questions and everything else from their own pools', () => {
    assert.equal(getReply('why though?', brain, first).emoji, '🤔');
    assert.equal(getReply('whatever', brain, first).emoji, '🤷');
    assert.equal(getReply('', brain, first).emoji, '🤷');
  });
  it('never throws on odd input', () => {
    for (const text of ['\u0000', '   ', '?', '😀'.repeat(1000), 'a'.repeat(100_000)]) {
      assert.ok(getReply(text, brain).emoji);
    }
  });
});

describe('toSearchQuery', () => {
  it('drops filler words, keeps at most six, and adds the suffix', () => {
    assert.equal(
      toSearchQuery('hey can you please show me a happy dancing cat', 'reaction'),
      'show happy dancing cat reaction',
    );
    assert.equal(
      toSearchQuery('one two three four five six seven eight'),
      'one two three four five six',
    );
  });
  it('falls back to the raw words when everything is filler', () => {
    assert.equal(toSearchQuery('hey you'), 'hey you');
  });
  it('is empty when nothing is searchable', () => {
    for (const text of ['', '🔥🔥', '123 456', '!!!'])
      assert.equal(toSearchQuery(text, 'reaction'), '', text);
  });
});
