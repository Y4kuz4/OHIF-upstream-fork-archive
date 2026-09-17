/** @type {AppTypes.Config} */
// Lab RIS2026: misma pinta que viewer.ohif.org (ui-next + theme) contra dcm4chee.
window.config = {
  name: 'config/local_ris_dcm4chee.js',
  routerBasename: null,
  extensions: [],
  modes: [],
  customizationService: ['@ohif/extension-default.customizationModule.theme'],
  showStudyList: true,
  maxNumberOfWebWorkers: 3,
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  experimentalStudyBrowserSort: false,
  strictZSpacingForVolumeViewport: true,
  groupEnabledModesFirst: true,
  allowMultiSelectExport: false,
  measurementTrackingMode: 'simplified',
  showErrorDetails: 'always',
  defaultDataSourceName: 'dicomweb',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'RIS2026 dcm4chee (lab)',
        name: 'DCM4CHEE',
        wadoUriRoot: '/dcm4chee-arc/aets/DCM4CHEE/wado',
        qidoRoot: '/dcm4chee-arc/aets/DCM4CHEE/rs',
        wadoRoot: '/dcm4chee-arc/aets/DCM4CHEE/rs',
        qidoSupportsIncludeField: true,
        imageRendering: 'wadors',
        enableStudyLazyLoad: true,
        thumbnailRendering: 'thumbnail',
        thumbnailRequestStrategy: 'fetch',
        supportsWildcard: true,
        requestOptions: {
          auth: 'admin:admin',
        },
        dicomUploadEnabled: true,
        supportsReject: true,
        supportsStow: true,
        singlepart: 'pdf,video',
        bulkDataURI: {
          enabled: true,
        },
        omitQuotationForMultipartRequest: true,
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomjson',
      sourceName: 'dicomjson',
      configuration: {
        friendlyName: 'dicom json',
        name: 'json',
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: {
        friendlyName: 'dicom local',
      },
    },
  ],
  studyListFunctionsEnabled: true,
};
