/**
 * @format
 */

import 'react-native-get-random-values';
import { install as installQuickCrypto } from 'react-native-quick-crypto';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

installQuickCrypto();

AppRegistry.registerComponent(appName, () => App);
