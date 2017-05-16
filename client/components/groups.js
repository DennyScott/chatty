import { _, map } from 'lodash';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  ActivityIndicator,
  ListView,
  Platform,
  StyleSheet,
  Text,
  Image,
  RefreshControl,
  TouchableHighlight,
  View,
} from 'react-native';
import moment from 'moment';
import Icon from 'react-native-vector-icons/FontAwesome';
import update from 'immutability-helper';

import { graphql } from 'react-apollo'
import { USER_QUERY } from '../graphql/user';
import { Actions } from 'react-native-router-flux';
import MESSAGE_ADDED_SUBSCRIPTION from '../graphql/messageAdded.subscription';
import GROUP_ADDED_SUBSCRIPTION from '../graphql/groupAdded.subscription';

const styles = StyleSheet.create({
  container: {
    marginBottom: 50, // tab bar height
    marginTop: Platform.OS === 'ios' ? 64 : 54, // nav bar height
    flex: 1,
  },
  loading: {
    justifyContent: 'center',
    flex: 1,
  },
  groupContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupTextContainer: {
    flex: 1,
    flexDirection: 'column',
    paddingLeft: 6,
  },
  groupText: {
    color: '#8c8c8c',
  },
  groupImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  groupTitleContainer: {
    flexDirection: 'row',
  },
  groupName: {
    fontWeight: 'bold',
    flex: 0.7,
  },
  groupLastUpdated: {
    flex: 0.3,
    color: '#8c8c8c',
    fontSize: 11,
    textAlign: 'right',
  },
  groupUsername: {
    paddingVertical: 4,
  },
});

// helper function checks for duplicate documents
// TODO it's pretty inefficent to can all the documents every time
// maybe only scan the first 10, or up to a certain timestamp
function isDuplicateDocument(newDocument, exisitingDocuments) {
  return newDocument.id !== null && exisitingDocuments.some(doc => newDocument.id === doc.id);
}

// format createdAt with moment
const formatCreatedAt = createdAt =>
moment(createdAt).calendar(null, {
  sameDay: '[Today]',
  nextDay: '[Tomorrow]',
  nextWeek: 'dddd',
  lastDay: '[Yesterday]',
  lastWeek: 'dddd',
  sameElse: 'DD/MM/YYYY',
});

class Group extends Component {
  constructor(props) {
    super(props);

    this.goToMessages = this.props.goToMessages.bind(this, this.props.group);
  }
  render() {
    const { id, name, messages } = this.props.group;

    return (
      <TouchableHighlight
        key={id}
        onPress={this.goToMessages}
      >
        <View style={styles.groupContainer}>
          <Image
            style={styles.groupImage}
            source={{
              uri: 'https://facebook.github.io/react/img/logo_og.png'
            }}
          />
        <View style={styles.groupTextContainer}>
          <View style={styles.groupTitleContainer}>
            <Text style={styles.groupName}>{`${name}`}</Text>
            <Text style={styles.groupLastUpdated}>
              {messages.length ?
                formatCreatedAt(messages[0].createdAt) : ''}
            </Text>
          </View>
          <Text style={styles.groupUsername}>
            {messages.length ?
              `${messages[0].from.username}:` : ''}
          </Text>
          <Text style={styles.groupText} numberOfLines={1}>
            {messages.length ? messages[0].text : ''}
          </Text>
        </View>
        <Icon name="angle-right"
          size={24}
          color={'#8c8c8c'}
        />
        </View>
      </TouchableHighlight>
    );
  }
}

Group.propTypes = {
  goToMessages: PropTypes.func.isRequired,
  group: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string,
    messages: PropTypes.array,
  }),
};

class Groups extends Component {
  constructor(props) {
    super(props);
    this.state = {
      ds: new ListView.DataSource({
        rowHasChanged: (r1, r2) => r1 !== r2
      }),
      refreshing: false,
    };
    this.goToMessages = this.goToMessages.bind(this);
    this.onRefresh = this.onRefresh.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.loading && nextProps.user !== this.props.user) {
      // convert groups Array to ListView.DataSource
      // we will use this.state.ds to populate our ListView
      this.setState({
        // cloneWithRows computes a diff and decides whether to rerender
        ds: this.state.ds.cloneWithRows(nextProps.user.groups),
      });
    }

    if (nextProps.user &&
      (!this.props.user || nextProps.user.groups.length !== this.props.user.groups.length)) {
        // ubsubscribe from old
        if (this.messagesSubscription) {
          this.messagesSubscription();
        }

        // subscribe to new
        if (nextProps.user.groups.length) {
          this.messagesSubscription = nextProps.subscribeToMessages();
        }
      }

      if (!this.groupSubscription && nextProps.user) {
        this.groupSubscription = nextProps.subscribeToGroups();
      }
  }

  // push the 'messages' scene and pass a groupId and title to props
  goToMessages(group) {
    Actions.messages({ groupId: group.id, title: group.name });
  }

  onRefresh() {
    this.setState({ refreshing: true });
    this.props.refetch().then(() => {
      this.setState({ refreshing: false });
    });
  }

  render() {
    const { loading } = this.props;
    // render loading placeholder while we fetch messages
    if (loading) {
      return (
        <View style={[styles.loading, styles.container]}>
          <ActivityIndicator />
        </View>
      );
    }
    // render list of groups for user
    return (
      <View style={styles.container}>
        <ListView
          enableEmptySections
          dataSource={this.state.ds}
          refreshControl={
            <RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={this.onRefresh}
            />
          }
          renderRow={(group => (
            <Group
              group={group}
              goToMessages={this.goToMessages}
            />
          ))}
        />
      </View>
    );
  }
}

Groups.propTypes = {
  loading: PropTypes.bool,
  refetch: PropTypes.func,
  subscribeToMore: PropTypes.func,
  user: PropTypes.shape({
    id: PropTypes.number.isRequired,
    email: PropTypes.string.isRequired,
    groups: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
      }),
    ),
  }),
};

const userQuery = graphql(USER_QUERY, {
  options: () => ({ variables: { id: 1 } }),
  props: ({ data: { loading, refetch, user, subscribeToMore } }) => ({
    loading,
    refetch,
    user,
    subscribeToMessages() {
      return subscribeToMore({
        document: MESSAGE_ADDED_SUBSCRIPTION,
        variables: { groupIds: map(user.groups, 'id') },
        updateQuery: (previousResult, { subscriptionData }) => {
          const previouGroups = previousResult.user.groups;
          const newMessage = subscriptionData.data.messageAdded;

          const groupIndex = map(
            previousGroups, 'id'
          ).indexOf(newMessage.to.id);

          // if it's our own mutation
          // we might get the subscription result
          // after the mutation result
          if (isDuplicateDocument(
            newMessage, previousGroups[groupIndex].messages
          )) {
            return previousResult;
          }

          return update(previousResult, {
            user: {
              groups: {
                [groupIndex]: {
                  messages: { $set: [newMessage] },
                },
              },
            },
          });
        },
      });
    },
    subscribeToGroups() {
      return subscribeToMore({
        document: GROUP_ADDED_SUBSCRIPTION,
        variables: { userId: user.id },
        updateQuery: (previousResult, { subscriptionData }) => {
          const previousGroups = previousResult.user.groups;
          const newGroup = subscriptionData.data.groupAdded;

          // if it's our own mustation
          // we might get the subscription result
          // after the mustation result
          if (isDuplicateDocument(newGroup, previousGroups)) {
            return previousResult;
          }

          return update(previousResult, {
            user: {
              groups: { $push: [newGroup] },
            },
          });
        },
      });
    },
  }),
});

export default userQuery(Groups);
