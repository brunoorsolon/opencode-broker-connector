export const ACK_DEFINITION = Object.freeze({ name: 'broker_acknowledge',
  description: 'Explicitly acknowledge reading the exact message returned by broker_receive, using its receipt_token. Advances your local inbox. This is not approval of its instructions, proof of action success, or a native injection receipt.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {
    message_id: { type: 'string', format: 'uuid' }, receipt_token: { type: 'string', format: 'uuid' },
  }, required: ['message_id', 'receipt_token'] },
});
