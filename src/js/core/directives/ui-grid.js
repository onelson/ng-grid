(function () {
  'use strict';

  angular.module('ui.grid').controller('uiGridController', ['$scope', '$element', '$attrs', '$log', 'gridUtil', '$q', 'uiGridConstants',
                    '$templateCache', 'gridClassFactory', '$timeout', '$parse', '$compile',
    function ($scope, $elm, $attrs, $log, gridUtil, $q, uiGridConstants,
              $templateCache, gridClassFactory, $timeout, $parse, $compile) {
      $log.debug('ui-grid controller');

      var self = this;

      // Extend options with ui-grid attribute reference
      self.grid = gridClassFactory.createGrid($scope.uiGrid);


      //add optional reference to externalScopes function to controller
      //so it can be retrieved in lower elements that have isolate scope
      self.getExternalScopes = $scope.getExternalScopes;
      
      // angular.extend(self.grid.options, );

      //all properties of grid are available on scope
      $scope.grid = self.grid;

      // Function to pre-compile all the cell templates when the column definitions change
      function preCompileCellTemplates(columns) {
        columns.forEach(function (col) {
          var html = col.cellTemplate.replace(uiGridConstants.COL_FIELD, 'getCellValue(row, col)');
          
          var compiledElementFn = $compile(html);
          col.compiledElementFn = compiledElementFn;
        });
      }

      //TODO: Move this.
      $scope.groupings = [];


      if ($attrs.uiGridColumns) {
        $attrs.$observe('uiGridColumns', function(value) {
          self.grid.options.columnDefs = value;
          self.grid.buildColumns()
            .then(function(){
              // self.columnSizeCalculated = false;
              // self.renderedColumns = self.grid.columns;

              preCompileCellTemplates($scope.grid.columns);

              self.refreshCanvas(true);
            });
        });
      }
      else {
        if (self.grid.options.columnDefs.length > 0) {
        //   self.grid.buildColumns();
        }
      }


      var dataWatchCollectionDereg;
      if (angular.isString($scope.uiGrid.data)) {
        dataWatchCollectionDereg = $scope.$parent.$watchCollection($scope.uiGrid.data, dataWatchFunction);
      }
      else {
        dataWatchCollectionDereg = $scope.$parent.$watchCollection(function() { return $scope.uiGrid.data; }, dataWatchFunction);
      }

      var columnDefWatchCollectionDereg = $scope.$parent.$watchCollection(function() { return $scope.uiGrid.columnDefs; }, columnDefsWatchFunction);

      function columnDefsWatchFunction(n, o) {
        if (n && n !== o) {
          self.grid.options.columnDefs = n;
          self.grid.buildColumns()
            .then(function(){
              // self.columnSizeCalculated = false;
              // self.renderedColumns = self.grid.columns;

              preCompileCellTemplates($scope.grid.columns);

              self.refreshCanvas(true);
            });
        }
      }

      function dataWatchFunction(n) {
        $log.debug('dataWatch fired');
        var promises = [];

        if (n) {
          if(self.grid.columns.length === 0){
            $log.debug('loading cols in dataWatchFunction');
            if (!$attrs.uiGridColumns && self.grid.options.columnDefs.length === 0) {
              self.grid.options.columnDefs =  gridUtil.getColumnsFromData(n);
            }
            promises.push(self.grid.buildColumns()
              .then(function() {
                preCompileCellTemplates($scope.grid.columns);}
            ));
          }
          $q.all(promises).then(function() {
            //wrap data in a gridRow
            $log.debug('Modifying rows');
            self.grid.modifyRows(n)
              .then(function () {
                //todo: move this to the ui-body-directive and define how we handle ordered event registration
                if (self.viewport) {
                  var scrollTop = self.viewport[0].scrollTop;
                  var scrollLeft = self.viewport[0].scrollLeft;
                  self.adjustScrollVertical(scrollTop, 0, true);
                  self.adjustScrollHorizontal(scrollLeft, 0, true);
                }

                $scope.$evalAsync(function() {
                  self.refreshCanvas(true);
                });
              });
          });
        }
      }


      $scope.$on('$destroy', function() {
        dataWatchCollectionDereg();
        columnDefWatchCollectionDereg();
      });

      // TODO(c0bra): Do we need to destroy this watch on $destroy?
      $scope.$watch(function () { return self.grid.styleComputations; }, function() {
        self.refreshCanvas(true);
      });

      // Refresh the canvas drawable size
      $scope.grid.refreshCanvas = self.refreshCanvas = function(buildStyles) {
        if (buildStyles) {
          self.grid.buildStyles($scope);
        }

        var p = $q.defer();

        if (self.header) {
          // Putting in a timeout as it's not calculating after the grid element is rendered and filled out
          $timeout(function() {
            self.grid.headerHeight = gridUtil.outerElementHeight(self.header);
            p.resolve();
          });
        }
        else {
          // Timeout still needs to be here to trigger digest after styles have been rebuilt
          $timeout(function() {
            p.resolve();
          });
        }

        return p.promise;
      };

      self.getCellValue = function(row, col) {
        return $scope.grid.getCellValue(row, col);
      };

      $scope.grid.refreshRows = self.refreshRows = function () {
        return self.grid.processRowsProcessors(self.grid.rows)
          .then(function (renderableRows) {
            self.grid.setVisibleRows(renderableRows);

            self.redrawRows();

            self.refreshCanvas();
          });
      };

      /* Sorting Methods */
      

      /* Event Methods */

      //todo: throttle this event?
      self.fireScrollingEvent = function(args) {
        $scope.$broadcast(uiGridConstants.events.GRID_SCROLL, args);
      };

      self.fireEvent = function(eventName, args) {
        // Add the grid to the event arguments if it's not there
        if (typeof(args) === 'undefined' || args === undefined) {
          args = {};
        }
        
        if (typeof(args.grid) === 'undefined' || args.grid === undefined) {
          args.grid = self.grid;
        }

        $scope.$broadcast(eventName, args);
      };

    }]);

/**
 *  @ngdoc directive
 *  @name ui.grid.directive:uiGrid
 *  @element div
 *  @restrict EA
 *  @param {Object} uiGrid Options for the grid to use
 *  @param {Object=} external-scopes Add external-scopes='someScopeObjectYouNeed' attribute so you can access
 *            your scopes from within any custom templatedirective.  You access by $scope.getExternalScopes() function
 *  
 *  @description Create a very basic grid.
 *
 *  @example
    <example module="app">
      <file name="app.js">
        var app = angular.module('app', ['ui.grid']);

        app.controller('MainCtrl', ['$scope', function ($scope) {
          $scope.data = [
            { name: 'Bob', title: 'CEO' },
            { name: 'Frank', title: 'Lowly Developer' }
          ];
        }]);
      </file>
      <file name="index.html">
        <div ng-controller="MainCtrl">
          <div ui-grid="{ data: data }"></div>
        </div>
      </file>
    </example>
 */
angular.module('ui.grid').directive('uiGrid',
  [
    '$log',
    '$compile',
    '$templateCache',
    'gridUtil',
    function(
      $log,
      $compile,
      $templateCache,
      gridUtil
      ) {
      return {
        templateUrl: 'ui-grid/ui-grid',
        scope: {
          uiGrid: '=',
          getExternalScopes: '&?externalScopes' //optional functionwrapper around any needed external scope instances
        },
        replace: true,
        transclude: true,
        controller: 'uiGridController',
        compile: function () {
          return {
            post: function ($scope, $elm, $attrs, uiGridCtrl) {
              $log.debug('ui-grid postlink');

              uiGridCtrl.grid.element = $elm;

              uiGridCtrl.grid.gridWidth = $scope.gridWidth = gridUtil.elementWidth($elm);

              // Default canvasWidth to the grid width, in case we don't get any column definitions to calculate it from
              uiGridCtrl.grid.canvasWidth = uiGridCtrl.grid.gridWidth;

              uiGridCtrl.grid.gridHeight = $scope.gridHeight = gridUtil.elementHeight($elm);

              uiGridCtrl.scrollbars = [];

              uiGridCtrl.refreshCanvas();
            }
          };
        }
      };
    }
  ]);

})();