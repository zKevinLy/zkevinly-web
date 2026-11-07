import type { DirectoryPage } from '../types';

const resources: DirectoryPage = {
  type: 'directory',
  title: 'Resources',
  description: 'Public resources and documentation.',
  showInNav: true,

  items: [
    {
      title: 'FMHY (Free Media Heck Yeah)',
      description:
        'A community-maintained directory of free websites, tools, software, streaming, books, and digital resources.',
      href: 'https://github.com/fmhy/FMHY',
      tags: ['resources', 'free-media', 'directory', 'github'],
    },
    {
      title: 'Microsoft Activation Scripts | Massgravel',
      description: 'Windows activation scripts, installation resources, and licensing guides.',
      href: 'https://github.com/massgravel/Microsoft-Activation-Scripts',
      tags: ['windows', 'activation', 'github'],
      commands: [
        {
          label: 'PowerShell',
          command: 'irm https://get.activated.win | iex',
        },
      ],
    },
    {
      title: 'WinUtil | Chris Titus Tech',
      description:
        'Windows utility for system tweaks, debloating, updates, and software installation.',
      href: 'https://github.com/ChrisTitusTech/winutil',
      tags: ['windows', 'utility', 'github'],
      commands: [
        {
          label: 'PowerShell',
          command: 'irm https://christitus.com/win | iex',
        },
      ],
    },
  ],
};

export default resources;
