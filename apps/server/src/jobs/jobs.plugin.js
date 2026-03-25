export function createJobsService() {
  return {
    enqueue() {
      return { accepted: false, reason: 'queue not configured' };
    }
  };
}
