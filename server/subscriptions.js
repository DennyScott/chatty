import { PubSub, SubscriptionManager } from 'graphql-subscriptions';

// we need the executableSchema -- gotta refactor schema.js
import { executableSchema } from './data/schema';

export const pubsub = new PubSub();

export const subscriptionManager = new SubscriptionManager({
  schema: executableSchema,
  pubsub,
  setupFunctions: {
    groupAdded: (options, args) => ({
      groupAdded: {
        // if the user is in the new group
        filter: group => args.userId &&
          ~map(group.users, 'id').indexOf(args.userId),
      },
    }),
    messageAdded: (options, args) => ({
      messageAdded: {
        filter: message => args.groupIds &&
          ~args.groupIds.indexOf(message.groupId),
      },
    }),
  },
});
