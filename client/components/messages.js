import { _ } from 'lodash';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ListView,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import randomColor from 'randomcolor';
import { graphql, compose } from 'react-apollo';
import update from 'immutability-helper';

import Message from './message';
import GROUP_QUERY from '../graphql/group';
import MessageInput from './message-input';
import CREATE_MESSAGE_MUTATION from '../graphql/createMessage.mutation';
import MESSAGE_ADDED_SUBSCRIPTION from '../graphql/messageAdded.subscription';

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
    backgroundColor: '#e5ddd5',
    flex: 1,
    flexDirection: 'column',
    paddingTop: 32,
  },
  loading: {
    justifyContent: 'center',
  },
  titleWrapper: {
    alignItems: 'center',
    marginTop: 10,
    position: 'absolute',
    ...Platform.select({
      ios: {
        top: 15,
      },
      android: {
        top: 5,
      },
    }),
    left: 0,
    right: 0,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleImage: {
    marginRight: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});

const fakeData = () => _.times(100, i => ({
  // every message will have a different color
  color: randomColor(),
  // every 5th color will look like it's from the current user
  isCurrentUser: i % 5 === 0,
  message: {
    id: i,
    createdAt: new Date().toISOString(),
    from: {
      username: `Username ${i}`,
    },
    text: `Message ${i}`,
  },
}));

export class Messages extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ds: new ListView.DataSource({
        rowHasChanged: (r1, r2) => r1 !== r2
      }),
      usernameColors: {},
      refreshing: false,
    };

    this.send = this.send.bind(this);
    //this.groupDetails = this.groupDetails.bind(this);
    //this.renderTitle = this.renderTitle.bind(this);
    this.onLayout = this.onLayout.bind(this);
    this.onContentSizeChange = this.onContentSizeChange.bind(this);
    this.onRefresh = this.onRefresh.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const oldData = this.props;
    const newData = nextProps;

    const usernameColors = {};

    // check for new messages
    if (newData.group) {
      if (newData.group.users) {
        // apply a color to each user
        newData.group.users.forEach((user) => {
          usernameColors[user.username] = this.state.usernameColors[user.username] || randomColor();
        });
      }

      if (!!newData.group.messages
        && (!oldData.group
          || newData.group.messages !== oldData.group.messages)) {
        // convert messages Array to ListView.DataSource
        // we will use this.state.ds to populte our ListView
        this.setState({
          ds: this.state.ds.cloneWithRows(
            // reverse the array so newest messages
            // show up at the borderBottomWidth
            newData.group.messages.slice().reverse(),
          ),
          usernameColors,
        });
      }
    }

    // we don't resubscribe on changed props
    // because it never happens in our app
    if (!this.subscription && !newData.loading) {
      this.subscription = newData.subscribeToMore({
        document: MESSAGE_ADDED_SUBSCRIPTION,
        variables: { groupIds: [newData.groupId] },
        updateQuery: (previousResult, { subscriptionData }) => {
          const newMessage = subscriptionData.data.messageAdded;

          // if it's our own Mutation
          // we might get the subscription results
          // after the mutation results
          if (isDuplicateMessage(
            newMessage, previousResult.group.messages,
          )) {
            return previousResult;
          }

          return update(previousResult, {
            group: {
              messages: {
                $unshift: [newMessage],
              },
            },
          });
        },
      });
    }
  }

  send(text) {
    this.props.createMessage({
      groupId: this.props.groupId,
      userId: 1, // faking the user for now
      text,
    });

    this.setState({
      shouldScrollToBottom: true,
    });
  }

  onContentSizeChange(w, h) {
    if (this.state.shouldScrollToBottom && this.state.height < h) {
      this.listView.scrollToEnd({ animated: true });
      this.setState({
        shouldScrollToBottom: false,
      });
    }
  }

  onLayout(e) {
    const { height } = e.nativeEvent.layout;
    this.setState({ height });
  }

  onRefresh() {
    this.setState({ refreshing: true });
    // placeholder for now until we implement pagination
    this.props.loadMoreEntries().then(() => {
      this.setState({
        refreshing: false,
      });
    });
  }

  render() {
    const { loading, group } = this.props;

    // render loading placeholder while we fetch messages
    if (loading && !group) {
      return (
        <View style={[styles.loading, styles.container]}>
          <ActivityIndicator />
        </View>
      );
    }

    // render list of messages for group
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={'position'}
        contentContainerStyle={styles.container}
      >
        <ListView
          ref={(ref) => { this.listView = ref; }}
          style={styles.listView}
          enableEmptySections
          dataSource={this.state.ds}
          refreshControl={
            <RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={this.onRefresh}
            />
          }
          onContentSizeChange={this.onContentSizeChange}
          onLayout={this.onLayout}
          renderRow={message => (
            <Message
              color={this.state.usernameColors[message.from.username]}
              isCurrentUser={message.from.id === 1} // for now until we implement auth
              message={message}
            />
          )}
        />
        <MessageInput send={this.send} />
      </KeyboardAvoidingView>
    );
  }
}

Messages.propTypes = {
  group: PropTypes.shape({
    messages: PropTypes.array,
    users: PropTypes.array,
  }),
  loading: PropTypes.bool,
  loadMoreEntries: PropTypes.func,
  groupId: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
};

const ITEMS_PER_PAGE = 10;
const groupQuery = graphql(GROUP_QUERY, {
  options: ({ groupId }) => ({
    variables: {
      groupId,
      offset: 0,
      limit: ITEMS_PER_PAGE,
    },
  }),
  props: ({ data: { fetchMore, loading, group, subscribeToMore } }) => ({
    loading,
    group,
    subscribeToMore,
    loadMoreEntries() {
      return fetchMore({
        // query: ... (you can specify a different query.
        // GROUP_QUERY is used by default )
        variables: {
          // We are able to figure out offset because it matches
          // the current messages length
          offset: group.messages.length,
        },
        updateQuery: (previousResult, { fetchMoreResult }) => {
          // we will make an extra call to check if no more entries
          if (!fetchMoreResult) { return previousResult; }

          // push results (older messages) to end of message list
          return update(previousResult, {
            group: {
              messages: { $push: fetchMoreResult.group.messages },
            },
          });
        },
      });
    },
  }),
});

// helper function checks for duplicate comments
// it's pretty inefficient to scan all comments every time, but we're gonna
// keep things simple-ish for now
function isDuplicateMessage(newMessage, exisitingMessages) {
  return newMessage.id !== null
    && exisitingMessages.some(message => newMessage.id === message.id);
}

const createMessage = graphql(CREATE_MESSAGE_MUTATION, {
  props: ({ ownProps, mutate }) => ({
    createMessage: ({ text, userId, groupId }) =>
      mutate({
        variables: { text, userId, groupId },
        optimisticResponse: {
          __typename: 'Mutation',
          createMessage: {
            __typename: 'Message',
            id: null, // don't know id yet, but it doesn't matter
            text, // we know what the text will be
            createdAt: new Date().toISOString(), // the time is now!
            from: {
              __typename: 'User',
              id: 1, // still faking the user
              username: 'Justyn.Kautzer', // still faking the user
              // maybe we should stop faking the user soon!
            },
          },
        },
        updateQueries: {
          group: (previousResult, { mutationResult }) => {
            const newMessage = mutationResult.data.createMessage;

            if (isDuplicateMessage(newMessage, previousResult.group.messages)) {
              return previousResult;
            }

            return update(previousResult, {
              group: {
                messages: {
                  $unshift: [newMessage],
                },
              },
            });
          },
        },
      }),
  }),
});

export default compose(
  groupQuery,
  createMessage,
)(Messages);
