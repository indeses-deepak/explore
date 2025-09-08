// src/utils/timeUtils.ts
import { config } from 'dotenv';
config(); // This loads the .env file

export function getMumbaiTimestamp(): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: process.env.MUMBAI_TIMEZONE || 'Asia/Kolkata', // Use the environment variable if set
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };

  return new Intl.DateTimeFormat('en-IN', options).format(new Date());
}
