var gridEvents = new GridEvents();

module.exports.gridEvents = gridEvents;


document.addEventListener('mousemove', function(e) {
    var gemm = gridEvents.mousemove;

    e.x = e.x || e.clientX;
    e.y = e.y || e.clientY;

    gemm.notify.bind(gemm)(e, gridEvents);
});


document.addEventListener('mousedown', function(e) {
    var gemd = gridEvents.mousedown;

    e.x = e.x || e.clientX;
    e.y = e.y || e.clientY;

    gemd.notify.bind(gemd)(e, gridEvents);
});


document.addEventListener('mouseup', function(e) {
    var gemu = gridEvents.mouseup;

    e.x = e.x || e.clientX;
    e.y = e.y || e.clientY;

    gemu.notify.bind(gemu)(e, gridEvents);
});


function SimpleObservable() {
    this.observers  = [];
};


SimpleObservable.prototype.addObserver = function(callback){
    this.observers.push(callback);
};

SimpleObservable.prototype.removeObserver = function(callback){
    var callbackIndex = this.observers.indexOf(callback);

    if (callbackIndex !== -1) {
        this.observers.splice(callbackIndex, 1);
    }
};

SimpleObservable.prototype.notify = function() {
    var i = 0,
        len = this.observers.length;

    for (; i < len; i++) {
        this.observers[i].apply(this, Array.prototype.slice.call(arguments));
    }

};


function GridEvents() {
    // generic DOM events
    this.mouseup = Object.create(new SimpleObservable());
    this.mousedown = Object.create(new SimpleObservable());
    this.mousemove = Object.create(new SimpleObservable());
};