import moment, { Moment } from 'moment-timezone';

const TIMEZONE = 'Asia/Kolkata';

class TimeService {
  /**
   * Get current ISO string in Asia/Kolkata timezone
   */
  static nowISO(): string {
    return moment().tz(TIMEZONE).format(); // ISO format
  }

  /**
   * Get formatted string in Asia/Kolkata timezone
   */
  static nowFormatted(format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    return moment().tz(TIMEZONE).format(format);
  }

  /**
   * Get Unix timestamp (seconds since epoch) in Asia/Kolkata timezone context
   */
  static nowUnix(): number {
    return moment().tz(TIMEZONE).unix();
  }

  /**
   * Get time in milliseconds since epoch in Asia/Kolkata context
   * (mimics Date().getTime() but using Asia/Kolkata)
   */
  static getTime(): number {
    return moment().tz(TIMEZONE).valueOf(); // ms since epoch
  }

  /**
   * Get native JS Date object adjusted to Asia/Kolkata time
   */
  static newDate(): Date {
    return new Date(moment().tz(TIMEZONE).format());
  }

  /**
   * Parse a date string into moment object in Asia/Kolkata
   */
  static parse(dateString: string, format: string): Moment {
    return moment.tz(dateString, format, TIMEZONE);
  }

  /**
   * Get the configured timezone
   */
  static getTimezone(): string {
    return TIMEZONE;
  }
}

export default TimeService;
