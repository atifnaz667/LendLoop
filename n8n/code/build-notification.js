// Turns a request event into a short message for the recipient. Uses only the
// minimized fields LendLoop sends (first names, tool name, dates).
const { event } = $input.first().json;
const { recipient, counterpart, tool, dates } = event;
const range = `${dates.start} to ${dates.end}`;

const templates = {
  "request.created": {
    subject: `${counterpart.firstName} wants to borrow your ${tool.name}`,
    text: `${counterpart.firstName} asked to borrow your ${tool.name} for ${range}. Open LendLoop to approve or decline.`,
  },
  "request.approved": {
    subject: `Your request for the ${tool.name} was approved`,
    text: `Good news! ${counterpart.firstName} approved your request for the ${tool.name} (${range}).`,
  },
  "request.declined": {
    subject: `Your request for the ${tool.name} was declined`,
    text:
      event.reason === "listing_removed"
        ? `The ${tool.name} is no longer listed, so your request for ${range} was closed.`
        : event.reason === "dates_taken"
          ? `The ${tool.name} was booked by someone else for ${range}. Try other dates.`
          : `${counterpart.firstName} couldn't lend the ${tool.name} for ${range}.`,
  },
  "request.cancelled": {
    subject: `${counterpart.firstName} cancelled a request`,
    text: `${counterpart.firstName} cancelled their request for your ${tool.name} (${range}).`,
  },
  "request.returned": {
    subject: `Thanks for returning the ${tool.name}`,
    text: `${counterpart.firstName} marked the ${tool.name} as returned. Thanks for borrowing responsibly!`,
  },
};

const message = templates[event.eventType];
if (!message) throw new Error(`Unknown event type: ${event.eventType}`);

return [
  {
    json: {
      eventId: event.eventId,
      to: { firstName: recipient.firstName, email: recipient.email },
      subject: message.subject,
      text: `Hi ${recipient.firstName}, ${message.text}`,
      writeback: {
        requestId: event.requestId,
        kind: "notification_sent",
        idempotencyKey: `notification:${event.eventId}`,
      },
    },
  },
];
