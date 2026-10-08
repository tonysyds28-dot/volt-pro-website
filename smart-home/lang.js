// Language toggle for the Volt Pro Smart Home pages.
// The app opens these pages with ?lang=ar|en; visitors can switch with the buttons.
(function () {
    var SUPPORTED = ['ar', 'en'];
    var root = document.documentElement;
    root.classList.add('js');

    function fromQuery() {
        var match = /[?&]lang=([a-zA-Z-]+)/.exec(window.location.search);
        return match ? match[1].toLowerCase().split('-')[0] : null;
    }

    function apply(lang) {
        if (SUPPORTED.indexOf(lang) === -1) lang = 'ar';
        root.lang = lang;
        root.dir = lang === 'ar' ? 'rtl' : 'ltr';
        var buttons = document.querySelectorAll('.lang-switch button');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].setAttribute('aria-pressed', String(buttons[i].dataset.set === lang));
        }
        // Keep the choice when moving between the three pages.
        var links = document.querySelectorAll('a[data-keep-lang]');
        for (var j = 0; j < links.length; j++) {
            links[j].href = links[j].getAttribute('href').split('?')[0] + '?lang=' + lang;
        }
        var title = document.querySelector('meta[name="title-' + lang + '"]');
        if (title) document.title = title.content;
    }

    apply(fromQuery() || 'ar');

    document.addEventListener('click', function (event) {
        var button = event.target.closest ? event.target.closest('.lang-switch button') : null;
        if (button) apply(button.dataset.set);
    });
})();
