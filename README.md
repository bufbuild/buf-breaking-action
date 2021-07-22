# buf-breaking-action

Verify backwards compatibility for your Protobuf files with
[buf](https://github.com/bufbuild/buf) and comment in-line on
pull requests.

  ![image](./static/img/breaking.png)

## Usage

Refer to the [action.yml](https://github.com/bufbuild/buf-breaking-action/blob/master/action.yml)
to see all of the action parameters.

The `buf-breaking` action requires that `buf` is installed in the Github Action
runner, so we'll use the [buf-setup][1] action to install it.

In most cases, you'll only need to configure several variables which are referenced
in the examples below. In these examples, we'll configure the action on the
hypothetical `https://github.com/acme/weather.git` repository.

### Pull requests

```yaml
on: pull_request
steps:
  - uses: actions/checkout@v2
  - uses: bufbuild/buf-setup-action@v0.3.0
  - uses: bufbuild/buf-breaking-action@v0.3.0
    env:
      BUF_INPUT_HTTPS_USERNAME: ${{ github.actor }}
      BUF_INPUT_HTTPS_PASSWORD: ${{ github.token }}
    with:
      against: 'https://github.com/acme/weather.git#branch=main'
```

### Push

When we configure this action on `push`, we often need to update the reference to
check compatibility `against` so that we don't accidentally verify against the same
commit.

For example, if we want to run the `buf-breaking` action for all commits pushed to
the `main` branch, we'll need to update our `against` reference to refer to the
previous commit, i.e. `HEAD~1`.

```yaml
on:
  push:
    branches:
      - main
steps:
  - uses: actions/checkout@v2
  - uses: bufbuild/buf-setup-action@v0.3.0
  - uses: bufbuild/buf-breaking-action@v0.3.0
    env:
      BUF_INPUT_HTTPS_USERNAME: ${{ github.actor }}
      BUF_INPUT_HTTPS_PASSWORD: ${{ github.token }}
    with:
      against: 'https://github.com/acme/weather.git#branch=main,ref=HEAD~1'
```

### Inputs

Some repositories are structured so that their `buf.yaml` is defined
in a sub-directory alongside their Protobuf sources, such as a `proto/`
directory. In this case, you can specify the relative `input` path and
the `subdir` option in the `against` reference (this is relevant for
both `pull_request` and `push`).

```sh
$ tree
.
└── proto
    ├── acme
    │   └── weather
    │       └── v1
    │           └── weather.proto
    └── buf.yaml
```

```yaml
on:
  push:
    branches:
      - main
steps:
  - uses: actions/checkout@v2
  - uses: bufbuild/buf-setup-action@v0.3.0
  - uses: bufbuild/buf-breaking-action@v0.3.0
    env:
      BUF_INPUT_HTTPS_USERNAME: ${{ github.actor }}
      BUF_INPUT_HTTPS_PASSWORD: ${{ github.token }}
    with:
      input: 'proto'
      against: 'https://github.com/acme/weather.git#branch=main,ref=HEAD~1,subdir=proto'
```

The `buf-breaking` action is also commonly used alongside other `buf` actions,
such as [buf-lint][2] and [buf-push][3].

  [1]: https://github.com/marketplace/actions/buf-setup
  [2]: https://github.com/marketplace/actions/buf-lint
  [3]: https://github.com/marketplace/actions/buf-push
