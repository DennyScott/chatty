// server/index.js

import express from 'express';
import { graphqlExpress, graphiqlExpress } from 'graphql-server-express';
import bodyParser from 'body-parser';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { createServer } from 'http';

import { subscriptionManager } from './subscriptions'; // make sure this imports before executableSchema
import { executableSchema } from './data/schema';

const GRAPHQL_PORT = 8080;
const GRAPHQL_PATH = '/graphql';
const SUBSCRIPTIONS_PATH = '/subscriptions';

const app = express();
console.log(executableSchema);
// `context` must be an object and can't be undefined when using connectors
app.use('/graphql', bodyParser.json(), graphqlExpress({
  schema: executableSchema,
  context: {}, //at least(!) an empty object
}));

app.use('/graphiql', graphiqlExpress({
  endpointURL: GRAPHQL_PATH,
  subscriptionsEndpoint: `ws://localhost:${GRAPHQL_PORT}${SUBSCRIPTIONS_PATH}`,
}));

const graphQLServer = createServer(app);

graphQLServer.listen(GRAPHQL_PORT, () => {
  console.log(`GraphQL Server is now running on http://localhost:${GRAPHQL_PORT}/${GRAPHQL_PATH}`);

  console.log(`GraphQL Subscriptions are now running on ws://localhost:${GRAPHQL_PORT}/${SUBSCRIPTIONS_PATH}`);
});

// eslint-disable-next-line no-new
new SubscriptionServer({
  subscriptionManager,
}, {
  server: graphQLServer,
  path: SUBSCRIPTIONS_PATH,
});
