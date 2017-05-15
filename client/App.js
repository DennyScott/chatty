import React from 'react';
import { ApolloProvider } from 'react-apollo';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { composeWithDevTools } from 'remote-redux-devtools';
import ApolloClient, { createNetworkInterface } from 'apollo-client';

import { Routes, Scenes } from './components/routes';

const networkInterface = createNetworkInterface({ uri: 'http://localhost:8080/graphql' });

const client = new ApolloClient({
  networkInterface,
});

const store = createStore(
  combineReducers({
    apollo: client.reducer(),
  }),
  {}, // initial state
  composeWithDevTools(
    applyMiddleware(client.middleware()),
  ),
);

export default class App extends React.Component {
  render() {
    return (
      <ApolloProvider store={store} client={client}>
        <Routes scenes={Scenes} />
      </ApolloProvider>
    );
  }
}
