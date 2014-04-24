describe('Grid factory', function () {
  var $q, $scope, grid, Grid, GridRow, GridColumn, rows, returnedRows, column;

  beforeEach(module('ui.grid'));

  beforeEach(inject(function (_$q_, _$rootScope_, _Grid_, _GridRow_, _GridColumn_) {
    $q = _$q_;
    $scope = _$rootScope_;
    Grid = _Grid_;
    GridRow = _GridRow_;
    GridColumn = _GridColumn_;

    rows = [
      new GridRow({ a: 'one' }, 0),
      new GridRow({ a: 'two' }, 1)
    ];

    column = new GridColumn({ name: 'a' }, 0);

    grid = new Grid({ id: 1 });
    grid.rows = rows;
    grid.columns = [column];

    returnedRows = null;
  }));

  function runProcs () {
    grid.processRowsProcessors(grid.rows)
      .then(function (newRows) {
        returnedRows = newRows;
      });

    $scope.$digest();
  }

  describe('constructor', function() {
    it('should throw an exception if the provided id is invalid', function() {
      expect(function() {
        var grid = new Grid({ id: 'blah blah' });
      }).toThrow();
    });
  });

  describe('row processors', function () {
    var proc1, proc2, returnedRows;

    // Stub for adding function spies to
    function testObj() {

    }

    /* Actual rows processors */
    proc1 = function (rows) {
      rows.forEach(function (r) {
        r.c = 'foo';
      });

      return rows;
    };

    proc2 = function (rows) {
      var p = $q.defer();

      rows.forEach(function (r) {
        r.d = 'bar';
      });

      p.resolve(rows);

      return p.promise;
    };

    beforeEach(function () {
      // Create function spies but also call real functions
      testObj.proc1 = jasmine.createSpy('proc1').andCallFake(proc1);
      testObj.proc2 = jasmine.createSpy('proc2').andCallFake(proc2);

      // Register the two spies as rows processors
      grid.registerRowsProcessor(testObj.proc1);
      grid.registerRowsProcessor(testObj.proc2);
    });

    it('should call both processors', function() {
      runs(runProcs);

      runs(function () {
        expect(testObj.proc1).toHaveBeenCalled();
        expect(testObj.proc2).toHaveBeenCalled();
      });
    });

    it('should actually process the rows', function () {
      runs(runProcs);

      runs(function () {
        expect(rows[0].c).toEqual('foo');
        expect(rows[0].d).toEqual('bar');
        expect(rows[1].c).toEqual('foo');
        expect(rows[1].d).toEqual('bar');
      });
    });

    describe(', when deregistered, ', function () {
      it('should not be run', function () {
        grid.removeRowsProcessor(testObj.proc1);

        runs(runProcs);

        runs(function () {
          expect(testObj.proc1).not.toHaveBeenCalled();
          expect(testObj.proc2).toHaveBeenCalled();
        });
      });
    });
    
    describe(', when one is broken and does not return an array, ', function () {
      beforeEach(function () {
        grid.removeRowsProcessor(testObj.proc1);
        grid.removeRowsProcessor(testObj.proc2);

        grid.registerRowsProcessor(function (blargh) {
          return "goobers!";
        });
      });

      it('should throw an exception', function () {
        expect(function () {
          runProcs();
        }).toThrow();
      });
    });
  });

  describe('with no rows processors', function () {
    it('should have none registered', function () {
      expect(grid.rowsProcessors.length).toEqual(0);
    });

    it('processRowsProcessors should return a shallow copy of grid.rows', function () {
      runs(runProcs);

      runs(function() {
        expect(returnedRows).toEqual(grid.rows);
      });
    });
  });

  describe('registering a non-function as a rows processor', function () {
    it('should error', function () {
      expect(function () {
        grid.registerRowsProcessor('blah');
      }).toThrow();
    });
  });

  describe('sortColumn', function() {
    it('should throw an exception if no column parameter is provided', function() {
      expect(function () {
        grid.sortColumn();
      }).toThrow();

      try {
        grid.sortColumn();
      }
      catch (e) {
        expect(e.message).toContain('No column parameter provided', 'exception contains column name');
      }
    });
  });

  describe('rowSelect', function() {
    it('should have an empty selected property when no rows are selected', function() {
      expect(grid.selectedRows.length).toBe(0);
    });

    it('should allow single selection via grid.selectRow(index)',
      function () {
        grid.selectRow(1);
        expect(grid.rows[1].selected).toBe(true);
        expect(grid.selectedRows.length).toBe(1);
      });

    it('should replace previous selections when keep is false',
      function () {
        grid.selectRow(0);
        expect(grid.rows[0].selected).toBe(true);
        expect(grid.selectedRows.length).toBe(1);
        expect(grid.selectedRows[0]).toBe(0);
        grid.selectRow(1);
        expect(grid.rows[0].selected).toBe(false);
        expect(grid.rows[1].selected).toBe(true);
        expect(grid.selectedRows.length).toBe(1);
        expect(grid.selectedRows[0]).toBe(1);
      });

  });
});
