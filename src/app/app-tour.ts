import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

export const TOUR_STORAGE_KEY = 'dotx-mailmerge.tour-done.v1';

const TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-config',
    popover: {
      title: 'Theme library',
      description:
        'Pick the active theme that styles both the editor and the email. Download or upload it as JSON, or export a Word .dotx starter with matching styles.',
      side: 'right',
    },
  },
  {
    element: '#tour-editor',
    popover: {
      title: '01 · Import and edit',
      description:
        'Choose a .docx to import it as Markdown (Word styles are mapped to headings, quotes, lists and emphasis), then edit it here. Use {fullName}, {email} and {company} as placeholders.',
      side: 'right',
    },
  },
  {
    element: '[aria-label="Text formatting"]',
    popover: {
      title: 'Formatting toolbar',
      description: 'Apply paragraph styles, lists and the inline Word character styles to the current selection.',
      side: 'bottom',
    },
  },
  {
    element: '#tour-preview',
    popover: {
      title: '02 · Email preview',
      description:
        'The email is compiled with MJML as you type, filled with Faker sample data. "New sample data" generates a fresh set of values.',
      side: 'left',
    },
  },
  {
    element: '[aria-label="Email client preview"]',
    popover: {
      title: 'Email client emulation',
      description:
        'Choose Default, Gmail, Apple Mail or Outlook. In Dark app theme the preview emulates how each client renders dark mode. "Sync scroll" keeps both panels aligned.',
      side: 'bottom',
    },
  },
  {
    element: '[aria-label="Resize editor and preview"]',
    popover: {
      title: 'Resize panels',
      description: 'Drag this handle, or focus it and use the arrow keys, to change the width of each panel.',
      side: 'left',
    },
  },
  {
    element: '#color-theme',
    popover: {
      title: 'App theme',
      description: 'Switch between Light, Dark or System. Your choice is remembered.',
      side: 'bottom',
    },
  },
  {
    element: '#tour-help',
    popover: {
      title: 'Need this again?',
      description: 'Click Help at any time to replay this tour.',
      side: 'bottom',
    },
  },
];

export function isTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markTourDone(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  } catch {
    // Storage unavailable: the tour will simply show again next visit.
  }
}

export function startTour(): void {
  const tour = driver({
    showProgress: true,
    allowClose: true,
    steps: TOUR_STEPS.filter((step) => typeof step.element !== 'string' || document.querySelector(step.element)),
    onDestroyed: markTourDone,
  });
  tour.drive();
}
