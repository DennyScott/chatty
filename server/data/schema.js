import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import { Mocks } from './mocks';
import { Resolvers } from './resolvers';

export const Schema = [`
  # declare custom scalars
  scalar Date

  # a group chat entitiy
  type Group {
    id: Int! # unique id for the Group
    name: String # name of the Group
    users: [User]! # users in the Group
    messages(limit: Int, offset: Int): [Message] # messages sent to the Group
  }

  # a user -- keep type really simple for now
  type User {
    id: Int! # unique id for the user
    email: String! # we will also require a unique email per user
    username: String # this is the name we'll show other users
    messages: [Message] # messages sent by user
    groups: [Group] # groups the user belongs to
    friends: [User] # user's friends/contacts
  }

  # a message sent from a user to a group
  type Message {
    id: Int! # unique id for Message
    to: Group! # group message was sent in
    from: User! # user who sent the message
    text: String! # message Text
    createdAt: Date! # when message was created
  }

  # query for types
  type Query {
    # Return a user by their email or id
    user(email: String, id: Int): User

    # Return messages sent by a user via userId
    # Return messages sent to a group via groupId
    messages(groupId: Int, userId: Int): [Message]

    # Return a group by its id
    group(id: Int!): Group
  }

  type Mutation {
    # send a message to a group
    createMessage(
      text: String!, userId: Int!, groupId: Int!
    ): Message
    createGroup(
      name: String!, userIds: [Int]!, userId: Int!
    ): Group
  }

  type Subscription {
    # Subscription fires on every message added
    # for any of the groups with one of these groupIds
    messageAdded(groupIds: [Int]): Message
    groupAdded(userId: Int): Group
  }

  schema {
    query: Query,
    mutation: Mutation,
    subscription: Subscription
  }
`];

const executableSchema = makeExecutableSchema({
  typeDefs: Schema,
  resolvers: Resolvers,
});

// addMockFunctionsToSchema({
//   schema: executableSchema,
//   mocks: Mocks,
//   preserveResolvers: true,
// });

export { executableSchema };
