
import { SessionWithEmployee, Employee } from './types';

// Centralized admin email list - users who can switch between companies
export const ADMIN_EMAILS = [
  'asimmons@boon-health.com',
  'alexsimm95@gmail.com',
  'hello@boon-health.com',
  'zragland@boon-health.com',
  'canderson@boon-health.com',
  'anewman@boon-health.com',
  'chenrichs@boon-health.com',
];

export const MOCK_EMPLOYEES: Employee[] = [
  { id: 1, first_name: 'Alice', last_name: 'Johnson', email: 'alice@example.com', program: 'Engineering', avatar_url: 'https://picsum.photos/seed/alice/100/100', full_name: 'Alice Johnson' },
  { id: 2, first_name: 'Bob', last_name: 'Smith', email: 'bob@example.com', program: 'Design', avatar_url: 'https://picsum.photos/seed/bob/100/100', full_name: 'Bob Smith' },
  { id: 3, first_name: 'Charlie', last_name: 'Davis', email: 'charlie@example.com', program: 'Marketing', avatar_url: 'https://picsum.photos/seed/charlie/100/100', full_name: 'Charlie Davis' },
  { id: 4, first_name: 'Diana', last_name: 'Prince', email: 'diana@example.com', program: 'Executive', avatar_url: 'https://picsum.photos/seed/diana/100/100', full_name: 'Diana Prince' },
  { id: 5, first_name: 'Evan', last_name: 'Wright', email: 'evan@example.com', program: 'Engineering', avatar_url: 'https://picsum.photos/seed/evan/100/100', full_name: 'Evan Wright' },
];

export const MOCK_SESSIONS: SessionWithEmployee[] = [
  {
    id: 101,
    created_at: '2023-10-25T10:00:00Z',
    session_date: '2023-10-25',
    status: 'Completed',
    duration_minutes: 45,
    notes: 'Quarterly review discussion.',
    employee_id: 1,
    employee_manager: {
      id: 1,
      first_name: 'Alice',
      last_name: 'Johnson',
      email: 'alice@example.com',
      program: 'Engineering',
      avatar_url: 'https://picsum.photos/seed/alice/100/100',
      full_name: 'Alice Johnson'
    }
  },
  {
    id: 102,
    created_at: '2023-10-26T14:00:00Z',
    session_date: '2023-10-26',
    status: 'Completed',
    duration_minutes: 30,
    notes: 'Sync on project Alpha.',
    employee_id: 2,
    employee_manager: {
      id: 2,
      first_name: 'Bob',
      last_name: 'Smith',
      email: 'bob@example.com',
      program: 'Design',
      avatar_url: 'https://picsum.photos/seed/bob/100/100',
      full_name: 'Bob Smith'
    }
  },
  {
    id: 103,
    created_at: '2023-10-27T09:30:00Z',
    session_date: '2023-10-27',
    status: 'Scheduled',
    duration_minutes: 60,
    notes: 'Marketing strategy workshop.',
    employee_id: 3,
    employee_manager: {
      id: 3,
      first_name: 'Charlie',
      last_name: 'Davis',
      email: 'charlie@example.com',
      program: 'Marketing',
      avatar_url: 'https://picsum.photos/seed/charlie/100/100',
      full_name: 'Charlie Davis'
    }
  },
  {
    id: 104,
    created_at: '2023-10-28T11:00:00Z',
    session_date: '2023-10-28',
    status: 'Completed',
    duration_minutes: 45,
    notes: 'Leadership coaching session.',
    employee_id: 4,
    employee_manager: {
      id: 4,
      first_name: 'Diana',
      last_name: 'Prince',
      email: 'diana@example.com',
      program: 'Executive',
      avatar_url: 'https://picsum.photos/seed/diana/100/100',
      full_name: 'Diana Prince'
    }
  },
  {
    id: 105,
    created_at: '2023-10-29T15:15:00Z',
    session_date: '2023-10-29',
    status: 'No Show',
    duration_minutes: 25,
    notes: 'Quick standup regarding deployment.',
    employee_id: 5,
    employee_manager: {
      id: 5,
      first_name: 'Evan',
      last_name: 'Wright',
      email: 'evan@example.com',
      program: 'Engineering',
      avatar_url: 'https://picsum.photos/seed/evan/100/100',
      full_name: 'Evan Wright'
    }
  },
   {
    id: 106,
    created_at: '2023-10-30T10:00:00Z',
    session_date: '2023-10-30',
    status: 'Completed',
    duration_minutes: 50,
    notes: 'Deep dive into architecture.',
    employee_id: 1,
    employee_manager: {
      id: 1,
      first_name: 'Alice',
      last_name: 'Johnson',
      email: 'alice@example.com',
      program: 'Engineering',
      avatar_url: 'https://picsum.photos/seed/alice/100/100',
      full_name: 'Alice Johnson'
    }
  },
];
