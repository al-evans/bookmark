#!/usr/bin/env node
/**
 * Test script to verify the 3-5 PM PT reminder notification logic
 * Usage: node api/test-reading-reminder.mjs
 */

import { isPtClockTimeInWindow } from './_lib/cron.js';

function testTimeWindow() {
  console.log('\n=== Testing Time Window Logic ===\n');

  // Create test dates for different times in PT
  const testCases = [
    { name: '2:59 PM PT', hour: 14, minute: 59, shouldTrigger: false },
    { name: '3:00 PM PT', hour: 15, minute: 0, shouldTrigger: true },
    { name: '4:00 PM PT', hour: 16, minute: 0, shouldTrigger: true },
    { name: '5:59 PM PT', hour: 17, minute: 59, shouldTrigger: true },
    { name: '6:00 PM PT', hour: 18, minute: 0, shouldTrigger: false },
  ];
  
  testCases.forEach(({ name, hour, minute, shouldTrigger }) => {
    // Create a date for April 15, 2026 at the specified PT time
    // We need to convert PT time to UTC to create a valid Date object
    // April is UTC-7 (PDT)
    const ptOffsetHours = -7;
    const utcHour = hour - ptOffsetHours;
    const utcDate = utcHour >= 24 
      ? new Date('2026-04-16T' + String(utcHour - 24).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + 'Z')
      : new Date('2026-04-15T' + String(utcHour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + 'Z');

    const inWindow = isPtClockTimeInWindow(15, 180, utcDate);
    const status = inWindow === shouldTrigger ? '✓' : '✗';
    
    console.log(`${status} ${name}: ${inWindow ? 'TRIGGER' : 'SKIP'} (expected: ${shouldTrigger ? 'TRIGGER' : 'SKIP'})`);
  });

  console.log('\n=== Time Window Test Complete ===\n');
}

function testNotificationLogic() {
  console.log('=== Testing Notification Logic ===\n');
  
  const testCases = [
    {
      name: 'Book not updated today - SHOULD NOTIFY',
      books: [
        {
          id: 'b1',
          title: 'Dune',
          status: 'currently-reading',
          progressLog: [
            { date: '2026-04-14', currentPercent: 30 },
          ],
        },
      ],
      todayPt: '2026-04-15',
      shouldNotify: true,
    },
    {
      name: 'Book updated today - SHOULD NOT NOTIFY',
      books: [
        {
          id: 'b1',
          title: 'Dune',
          status: 'currently-reading',
          progressLog: [
            { date: '2026-04-14', currentPercent: 20 },
            { date: '2026-04-15', currentPercent: 30 },
          ],
        },
      ],
      todayPt: '2026-04-15',
      shouldNotify: false,
    },
    {
      name: 'Multiple books, one updated today - SHOULD NOT NOTIFY',
      books: [
        {
          id: 'b1',
          title: 'Dune',
          status: 'currently-reading',
          progressLog: [
            { date: '2026-04-15', currentPercent: 30 },
          ],
        },
        {
          id: 'b2',
          title: 'Neuromancer',
          status: 'currently-reading',
          progressLog: [
            { date: '2026-04-14', currentPercent: 50 },
          ],
        },
      ],
      todayPt: '2026-04-15',
      shouldNotify: false,
    },
    {
      name: 'No currently-reading books - SHOULD NOT NOTIFY',
      books: [
        {
          id: 'b1',
          title: 'Dune',
          status: 'read',
          progressLog: [
            { date: '2026-04-14', currentPercent: 100 },
          ],
        },
      ],
      todayPt: '2026-04-15',
      shouldNotify: false,
    },
    {
      name: 'Empty progress log - SHOULD NOTIFY',
      books: [
        {
          id: 'b1',
          title: 'Dune',
          status: 'currently-reading',
          progressLog: [],
        },
      ],
      todayPt: '2026-04-15',
      shouldNotify: true,
    },
  ];

  function shouldSendReminder(books, todayPt) {
    function latestProgressDate(book) {
      const logs = Array.isArray(book?.progressLog) ? book.progressLog : [];
      const dates = logs.map((entry) => {
        const value = entry?.date;
        return typeof value === 'string' ? value.slice(0, 10) : '';
      }).filter(Boolean);
      if (dates.length === 0) return '';
      return dates.sort().at(-1) || '';
    }

    const currentBooks = books.filter((book) => book.status === 'currently-reading');
    if (currentBooks.length === 0) return false;
    return currentBooks.every((book) => latestProgressDate(book) < todayPt);
  }

  testCases.forEach(({ name, books, todayPt, shouldNotify }) => {
    const result = shouldSendReminder(books, todayPt);
    const status = result === shouldNotify ? '✓' : '✗';
    console.log(`${status} ${name}: ${result ? 'NOTIFY' : 'SKIP'} (expected: ${shouldNotify ? 'NOTIFY' : 'SKIP'})`);
  });

  console.log('\n=== Notification Logic Test Complete ===\n');
}

// Run tests
testTimeWindow();
testNotificationLogic();

console.log('All tests completed successfully! ✓');
