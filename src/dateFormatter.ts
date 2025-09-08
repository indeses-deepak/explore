function getMumbaiTime() {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',   // Mumbai's time zone
      hour12: false,              // 24-hour format
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
  
    const mumbaiTime = new Intl.DateTimeFormat('en-IN', options).format(new Date());
    // console.log('Mumbai Time:', mumbaiTime);
  }
  
  getMumbaiTime();