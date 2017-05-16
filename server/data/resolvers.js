import GraphQLDate from 'graphql-date';
import { Group, User, Message } from './connectors';
import { pubsub } from '../subscriptions';

export const Resolvers = {
  Date: GraphQLDate,

  Query: {
    group(_, args) {
      return Group.find({ where: args });
    },

    messages(_, args) {
      return Message.findAll({
        where: args,
        order: [['createdAt', 'DESC']],
      });
    },

    user(_, args) {
      return User.findOne({ where: args });
    },
  },

  Mutation: {
    createMessage(_, { text, userId, groupId }) {
      return Message.create({
        userId,
        text,
        groupId,
      }).then((message) => {
        // publish subscription notification with the whole message
        pubsub.publish('messageAdded', message);
        return message;
      });
    },

    createGroup(_, { name, userIds, userId }) {
      return User.findOne({ where: { id: userId } })
        .then((user) => {
          return user.getFriends({ where: { id: { $in: userIds } }})
          .then((friends) => {
            return Group.create({
              name,
            }).then((group) => {
              return group.addUsers([user, ...friends])
              .then((res) => {
                // append the user list to the group object
                // to pass to pubsub so we can check members
                group.users = [user, ...friends];
                pubsub.publish('groupAdded', group);
                return group;
              });
            });
          });
        });
    },
  },

  Group: {
    users(group) {
      return group.getUsers();
    },
    messages(group, args) {
      return Message.findAll({
        where: { groupId: group.id },
        order: [['createdAt', 'DESC']],
        limit: args.limit,
        offset: args.offset,
      });
    },
  },

  Message: {
    to(message) {
      return message.getGroup();
    },
    from(message) {
      return message.getUser();
    },
  },

  User: {
    messages(user) {
      return Message.findAll({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
      });
    },
    groups(user) {
      return user.getGroups();
    },
    friends(user) {
      return user.getFriends();
    },
  },

  Subscription: {
    messageAdded(message) {
      // the subscirption payload is the message
      return message;
    },
    groupAdded(group) {
      return group;
    },
  },
};

export default Resolvers;
