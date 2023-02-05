export function debugLog(message?: any, ...optionalParams: any[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(message, ...optionalParams)
  }
}
