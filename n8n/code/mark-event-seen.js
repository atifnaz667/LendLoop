// Records the eventId only after LendLoop has accepted the write-back. If the
// notification or the write-back fails, LendLoop's retry is processed again
// (the write-back is idempotent on the LendLoop side), and a retry after full
// success is recognized as a duplicate.
const eventId = $("Send notification (mock)").first().json.eventId;
const staticData = $getWorkflowStaticData("global");
staticData.seenEventIds = staticData.seenEventIds || {};
staticData.seenEventIds[eventId] = Date.now();
return $input.all();
