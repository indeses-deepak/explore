interface Device {
    status: string;
    // Add other properties if necessary
}

export const clients: { [key: string]: Device } = {};
