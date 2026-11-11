import { CssBaseline } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import AppsIcon from '@mui/icons-material/Apps';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import DevicesIcon from '@mui/icons-material/Devices';
import FactoryIcon from '@mui/icons-material/Factory';
import ImageIcon from '@mui/icons-material/Image';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import KeyIcon from '@mui/icons-material/Key';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LockIcon from '@mui/icons-material/Lock';
import MemoryIcon from '@mui/icons-material/Memory';
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import PeopleIcon from '@mui/icons-material/People';
import PublicIcon from '@mui/icons-material/Public';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import TuneIcon from '@mui/icons-material/Tune';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import * as React from 'react';
import { Admin, CustomRoutes, Layout, Resource, fetchUtils } from 'react-admin';
import { Navigate, Route, useParams } from 'react-router-dom';
import type { Options } from 'ra-core';
import openbalenaAuthProvider from './authProvider/openbalenaAuthProvider';
import apiKey from './components/apiKey';
import config from './components/config';
import cpuArchitecture from './components/cpuArchitecture';
import device from './components/device';
import deviceConfigVar from './components/deviceConfigVar';
import deviceEnvVar from './components/deviceEnvVar';
import deviceFamily from './components/deviceFamily';
import deviceManufacturer from './components/deviceManufacturer';
import deviceServiceVar from './components/deviceServiceVar';
import deviceTag from './components/deviceTag';
import deviceType from './components/deviceType';
import deviceTypeAlias from './components/deviceTypeAlias';
import fleet from './components/fleet';
import fleetConfigVar from './components/fleetConfigVar';
import fleetEnvVar from './components/fleetEnvVar';
import fleetTag from './components/fleetTag';
import fleetType from './components/fleetType';
import image from './components/image';
import imageEnvVar from './components/imageEnvVar';
import imageLabel from './components/imageLabel';
import organization from './components/organization';
import permission from './components/permission';
import release from './components/release';
import releaseTag from './components/releaseTag';
import role from './components/role';
import service from './components/service';
import serviceEnvVar from './components/serviceEnvVar';
import serviceLabel from './components/serviceLabel';
import user from './components/user';
import userKey from './components/userKey';
import balenaOs from './components/balenaOs';
import DeviceDashboard from './dashboards/device';
import MainDashboard from './dashboards/main';
import VectorLogin from './vector/pages/Login';
import Deltas from './vector/pages/Deltas';
import AddDevice from './vector/pages/AddDevice';
import Docs from './vector/pages/Docs';
import openBalenaDataProvider from './dataProvider/openBalenaDataProvider';
import VectorSidebar from './vector/layout/VectorSidebar';
import versions from './versions';
import environment from './lib/reactAppEnv';
import ThemeModeProvider, { useThemeMode } from './ui/ThemeModeProvider';
import VectorTopbar from './vector/layout/VectorTopbar';
import { withSheets } from './vector/layout/sheet';

const httpClient = (url: string, options: Options = {}): ReturnType<typeof fetchUtils.fetchJson> => {
  const headers = new Headers((options.headers as HeadersInit) ?? { Accept: 'application/json' });
  const token = localStorage.getItem('auth');
  headers.set('Authorization', `Bearer ${token ?? ''}`);

  return fetchUtils.fetchJson(url, { ...options, headers });
};

const dataProvider = openBalenaDataProvider(
  environment.REACT_APP_OPEN_BALENA_API_URL,
  httpClient,
  environment.REACT_APP_OPEN_BALENA_API_VERSION,
  environment.REACT_APP_OPEN_BALENA_ODATA_VERSION,
);

const deviceTypeAliasVer = versions.optionalResource('deviceTypeAlias', environment.REACT_APP_OPEN_BALENA_API_VERSION);

const App: React.FC = () => (
  <ThemeModeProvider>
    <OpenBalenaAdmin />
  </ThemeModeProvider>
);

const NavigateToDevice: React.FC = () => {
  const { uuid } = useParams<{ uuid?: string }>();
  const targetUuid = uuid ?? '';
  return <Navigate to={`/#/device/0/show?uuid=${targetUuid}`} replace />;
};

const customRoutes: React.ReactElement[] = [
  <Route key='custom-route-device-summary' path='/devices/:uuid/summary' element={<NavigateToDevice />} />,
  <Route key='custom-route-deltas' path='/deltas' element={<Deltas />} />,
  <Route key='custom-route-add-device' path='/add-device' element={<AddDevice />} />,
];

/** Full-screen pages: rendered without the sidebar/top bar (they bring their own header). */
const fullScreenRoutes: React.ReactElement[] = [
  <Route key='full-route-docs' path='/docs' element={<Docs />} />,
  <Route key='full-route-docs-page' path='/docs/:slug' element={<Docs />} />,
];

const treeLayout: React.FC<React.ComponentProps<typeof Layout>> = (props) => {
  return (
    <>
      <Layout {...props} sidebar={VectorSidebar} appBar={VectorTopbar} />
      <CssBaseline />
    </>
  );
};

const OpenBalenaAdmin: React.FC = () => {
  const { theme } = useThemeMode();

  return (
    <Admin
      requireAuth
      title='Vector'
      disableTelemetry={true}
      dataProvider={dataProvider}
      authProvider={openbalenaAuthProvider}
      loginPage={VectorLogin}
      dashboard={MainDashboard}
      layout={treeLayout}
      theme={theme}
    >
      <CustomRoutes noLayout>{fullScreenRoutes}</CustomRoutes>
      <CustomRoutes>{customRoutes}</CustomRoutes>
      <Resource name='menu-access' icon={SecurityIcon} options={{ label: 'Access', isMenuParent: true }} />
      <Resource
        name='organization'
        icon={BusinessIcon}
        options={{ label: 'Orgs', menuParent: 'menu-access' }}
        {...withSheets(organization)}
      />
      <Resource name='user' icon={PeopleIcon} options={{ label: 'Users', menuParent: 'menu-access' }} {...withSheets(user)} />
      <Resource
        name='api key'
        icon={VpnKeyIcon}
        options={{ label: 'API Keys', menuParent: 'menu-access' }}
        {...withSheets(apiKey)}
      />
      <Resource
        name='user-has-public key'
        icon={KeyIcon}
        options={{ label: 'SSH Keys', menuParent: 'menu-access' }}
        {...withSheets(userKey)}
      />

      <Resource
        name='menu-fleet'
        icon={AccountTreeIcon}
        options={{ label: 'Fleets', isMenuParent: true, menuRoute: 'application' }}
      />
      <Resource name='application' icon={AppsIcon} options={{ label: 'Fleets', menuParent: 'menu-fleet' }} {...withSheets(fleet)} />
      <Resource
        name='application config variable'
        icon={TuneIcon}
        options={{ label: 'Config Vars', menuParent: 'menu-fleet' }}
        {...withSheets(fleetConfigVar)}
      />
      <Resource
        name='application environment variable'
        icon={PublicIcon}
        options={{ label: 'Environment Vars', menuParent: 'menu-fleet' }}
        {...withSheets(fleetEnvVar)}
      />
      <Resource
        name='application tag'
        icon={LocalOfferIcon}
        options={{ label: 'Tags', menuParent: 'menu-fleet' }}
        {...withSheets(fleetTag)}
      />

      <Resource
        name='menu-device'
        icon={DevicesIcon}
        options={{ label: 'Devices', isMenuParent: true, menuRoute: 'device' }}
      />
      <Resource
        name='device'
        icon={DevicesIcon}
        options={{ label: 'Devices', menuParent: 'menu-device' }}
        {...withSheets(device)}
        show={DeviceDashboard}
      />
      <Resource
        name='device config variable'
        icon={TuneIcon}
        options={{ label: 'Config Vars', menuParent: 'menu-device' }}
        {...withSheets(deviceConfigVar)}
      />
      <Resource
        name='device environment variable'
        icon={PublicIcon}
        options={{ label: 'Environment Vars', menuParent: 'menu-device' }}
        {...withSheets(deviceEnvVar)}
      />
      <Resource
        name='device service environment variable'
        icon={MiscellaneousServicesIcon}
        options={{ label: 'Service Vars', menuParent: 'menu-device' }}
        {...withSheets(deviceServiceVar)}
      />
      <Resource
        name='device tag'
        icon={LocalOfferIcon}
        options={{ label: 'Tags', menuParent: 'menu-device' }}
        {...withSheets(deviceTag)}
      />

      <Resource name='menu-image' icon={ImageIcon} options={{ label: 'Images', isMenuParent: true }} />
      <Resource name='image' icon={ImageIcon} options={{ label: 'Images', menuParent: 'menu-image' }} {...withSheets(image)} />
      <Resource
        name='image environment variable'
        icon={PublicIcon}
        options={{ label: 'Environment Vars', menuParent: 'menu-image' }}
        {...withSheets(imageEnvVar)}
      />
      <Resource
        name='image label'
        icon={LabelOutlinedIcon}
        options={{ label: 'Labels', menuParent: 'menu-image' }}
        {...withSheets(imageLabel)}
      />

      <Resource name='menu-release' icon={Inventory2Icon} options={{ label: 'Releases', isMenuParent: true }} />
      <Resource
        name='release'
        icon={Inventory2Icon}
        options={{ label: 'Releases', menuParent: 'menu-release' }}
        {...withSheets(release)}
      />
      <Resource
        name='release tag'
        icon={LocalOfferIcon}
        options={{ label: 'Tags', menuParent: 'menu-release' }}
        {...withSheets(releaseTag)}
      />

      <Resource
        name='menu-service'
        icon={MiscellaneousServicesIcon}
        options={{ label: 'Services', isMenuParent: true }}
      />
      <Resource
        name='service'
        icon={MiscellaneousServicesIcon}
        options={{ label: 'Services', menuParent: 'menu-service' }}
        {...withSheets(service)}
      />
      <Resource
        name='service environment variable'
        icon={PublicIcon}
        options={{ label: 'Environment Vars', menuParent: 'menu-service' }}
        {...withSheets(serviceEnvVar)}
      />
      <Resource
        name='service label'
        icon={LabelOutlinedIcon}
        options={{ label: 'Labels', menuParent: 'menu-service' }}
        {...withSheets(serviceLabel)}
      />
      <Resource
        name='balena-os'
        icon={SystemUpdateAltIcon}
        options={{ label: 'BalenaOS', menuParent: 'menu-service' }}
        {...withSheets(balenaOs)}
      />

      <Resource name='menu-static' icon={StorageIcon} options={{ label: 'Static Data', isMenuParent: true }} />
      <Resource
        name='config'
        icon={SettingsIcon}
        options={{ label: 'Configs', menuParent: 'menu-static', globalAdminOnly: true }}
        {...withSheets(config)}
      />
      <Resource
        name='cpu architecture'
        icon={MemoryIcon}
        options={{ label: 'CPU Architectures', menuParent: 'menu-static' }}
        {...withSheets(cpuArchitecture)}
      />
      <Resource
        name='device family'
        icon={CategoryIcon}
        options={{ label: 'Device Families', menuParent: 'menu-static' }}
        {...withSheets(deviceFamily)}
      />
      <Resource
        name='device manufacturer'
        icon={FactoryIcon}
        options={{ label: 'Device Mfgs', menuParent: 'menu-static' }}
        {...withSheets(deviceManufacturer)}
      />
      <Resource
        name='device type'
        icon={DeveloperBoardIcon}
        options={{ label: 'Device Types', menuParent: 'menu-static' }}
        {...withSheets(deviceType)}
      />
      {deviceTypeAliasVer ? (
        <Resource
          name='device type alias'
          icon={AltRouteIcon}
          options={{ label: 'DT Aliases', menuParent: 'menu-static' }}
          {...withSheets(deviceTypeAlias)}
        />
      ) : (
        <></>
      )}
      <Resource
        name='application type'
        icon={CategoryIcon}
        options={{ label: 'Fleet Types', menuParent: 'menu-static' }}
        {...withSheets(fleetType)}
      />
      <Resource
        name='permission'
        icon={LockIcon}
        options={{ label: 'Permissions', menuParent: 'menu-static', globalAdminOnly: true }}
        {...withSheets(permission)}
      />
      <Resource
        name='role'
        icon={AdminPanelSettingsIcon}
        options={{ label: 'Roles', menuParent: 'menu-static', globalAdminOnly: true }}
        {...withSheets(role)}
      />

      {/* Reference tables */}
      <Resource name='actor' />
      <Resource name='api key-has-permission' />
      <Resource name='api key-has-role' />
      <Resource name='image install' />
      <Resource name='image-is part of-release' />
      <Resource name='migration' />
      <Resource name='migration lock' />
      <Resource name='model' />
      <Resource name='organization membership' />
      <Resource name='role-has-permission' />
      <Resource name='service install' />
      <Resource name='service instance' />
      <Resource name='user-has-permission' />
      <Resource name='user-has-role' />
    </Admin>
  );
};

export default App;
